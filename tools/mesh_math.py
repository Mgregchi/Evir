"""Mesh export helpers: index validation and four-slot weight quantization."""

import math
from riv import uint


def index_bytes(triangles, vertex_count):
    if (
        not isinstance(vertex_count, int)
        or isinstance(vertex_count, bool)
        or not 1 <= vertex_count <= 65536
    ):
        raise ValueError("vertex_count must fit 16-bit vertex indices")
    if not triangles or len(triangles) % 3:
        raise ValueError("triangle list must contain complete triples")
    if any(
        not isinstance(i, int) or isinstance(i, bool) or not 0 <= i < vertex_count
        for i in triangles
    ):
        raise ValueError("triangle index out of range")
    return b"".join(uint(i) for i in triangles)


def packed_weights(influences, bone_count):
    if (
        not isinstance(bone_count, int)
        or isinstance(bone_count, bool)
        or not 1 <= bone_count <= 255
    ):
        raise ValueError("bone_count must fit one-based byte slots")
    if not 1 <= len(influences) <= 4:
        raise ValueError("one to four influences required")
    if len({b for b, w in influences}) != len(influences):
        raise ValueError("duplicate bone indices")
    for bone, weight in influences:
        if (
            not isinstance(bone, int)
            or isinstance(bone, bool)
            or not 0 <= bone < bone_count
        ):
            raise ValueError("bone index must reference an existing tendon")
        if (
            not isinstance(weight, (int, float))
            or isinstance(weight, bool)
            or not math.isfinite(weight)
            or weight < 0
        ):
            raise ValueError("finite nonnegative weights required")
    total = sum(w for b, w in influences)
    if not math.isfinite(total) or total <= 0:
        raise ValueError("positive finite weight sum required")
    scaled = [w / total * 255 for b, w in influences]
    values = [math.floor(w) for w in scaled]
    # Largest remainder, stable in authored order on ties.
    for i in sorted(range(len(values)), key=lambda i: -(scaled[i] - values[i]))[
        : 255 - sum(values)
    ]:
        values[i] += 1
    return sum((b + 1) << (8 * i) for i, (b, w) in enumerate(influences)), sum(
        w << (8 * i) for i, w in enumerate(values)
    )
