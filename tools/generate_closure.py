"""Final targeted compatibility cases. Asset pixels and geometry are authored here."""

import json, math, struct, zlib
from pathlib import Path
from riv import obj, parse, write, uint
from generate_fixtures import rect, scene, timeline
from generate_advanced import curve
from generate_complex import contour
from mesh_math import index_bytes, packed_weights

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "research/fixtures/closure"


def texture():
    def chunk(kind, body):
        return (
            struct.pack(">I", len(body))
            + kind
            + body
            + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
        )

    raw = b"".join(
        b"\0"
        + b"".join(
            bytes(
                (240, 40, 40, 255)
                if x < 32 and y < 32
                else (
                    (40, 220, 60, 255)
                    if y < 32
                    else (40, 80, 240, 255) if x < 32 else (240, 220, 40, 255)
                )
            )
            for x in range(64)
        )
        for y in range(64)
    )
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 64, 64, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def mesh(skinned=True, invalid=False):
    # Eight outline vertices plus a four-influence interior vertex, eight triangles.
    points = [
        (64, 64),
        (128, 64),
        (192, 64),
        (192, 128),
        (192, 192),
        (128, 192),
        (64, 192),
        (64, 128),
        (128, 128),
    ]
    bones = (
        [obj("RootBone", parentId=0, name=f"Bone{i}") for i in range(4)]
        if skinned
        else []
    )
    image = len(bones) + 1
    mesh_id = image + 1
    indices = [v for i in range(8) for v in (i, (i + 1) % 8, 8)]
    if invalid:
        indices[-1] = 9
    o = bones + [
        obj("Image", parentId=0, assetId=0),
        obj(
            "Mesh",
            parentId=image,
            triangleIndexBytes=(
                b"".join(uint(i) for i in indices)
                if invalid
                else index_bytes(indices, len(points))
            ).hex(),
        ),
    ]
    for i, (x, y) in enumerate(points):
        vertex = len(o) + 1
        o.append(
            obj(
                "ContourMeshVertex" if i < 8 else "MeshVertex",
                parentId=mesh_id,
                x=x,
                y=y,
                u=(x - 64) / 128,
                v=(y - 64) / 128,
            )
        )
        if skinned:
            weights = (
                [(1, 255)],
                [(1, 128), (2, 127)],
                [(2, 255)],
                [(2, 128), (3, 127)],
                [(3, 255)],
                [(3, 128), (4, 127)],
                [(4, 255)],
                [(4, 128), (1, 127)],
                [(1, 64), (2, 64), (3, 64), (4, 63)],
            )[i]
            packed_indices, packed_values = packed_weights(
                [(b - 1, w) for b, w in weights], bone_count=4
            )
            o.append(
                obj(
                    "Weight",
                    parentId=vertex,
                    indices=packed_indices,
                    values=packed_values,
                )
            )
    if skinned:
        skin_id = len(o) + 1
        o.append(obj("Skin", parentId=mesh_id, xx=1, yy=1))
        o.extend(
            obj("Tendon", parentId=skin_id, boneId=i + 1, xx=1, yy=1) for i in range(4)
        )
        # Four bones move differently. The center's four packed weights all contribute.
        for i, dy in enumerate([0, 24, 48, 24]):
            o += timeline(f"Bone{i}", i + 1, 91, [(0, 0), (30, dy), (60, 0)])
    d = scene("Mesh", o)
    d["objects"][1:1] = [
        obj("ImageAsset", name="Quadrants", assetId=1, width=64, height=64),
        obj("FileAssetContents", bytes=texture().hex()),
    ]
    return d


def rotated_mesh():
    d = mesh()
    first_animation = next(
        i
        for i, o in enumerate(d["objects"])
        if o["type"] == obj("LinearAnimation")["type"]
    )
    d["objects"] = d["objects"][:first_animation]
    for o in d["objects"]:
        if o["type"] == obj("RootBone")["type"]:
            o["properties"] += obj("RootBone", x=128, y=128)["properties"]
        if o["type"] == obj("Tendon")["type"]:
            o["properties"] += obj("Tendon", tx=128, ty=128)["properties"]
    d["objects"] += timeline(
        "Rotate",
        1,
        obj("RootBone", rotation=0)["properties"][0]["key"],
        [(0, 0), (30, math.pi / 4), (60, 0)],
    )
    return d


def controller(kind):
    o = (
        rect()
        + timeline("Left", 1, 13, [(0, 64), (60, 64)])
        + timeline("Right", 1, 13, [(0, 192), (60, 192)])
    )
    o += [
        obj("StateMachine", name="Controller"),
        obj("StateMachineBool", name="active"),
        obj("StateMachineNumber", name="level"),
        obj("StateMachineLayer"),
        obj("EntryState"),
        obj("StateTransition", stateToId=3),
        obj("AnyState"),
        obj("ExitState"),
        obj("AnimationState", animationId=0),
    ]
    flags = 1 if kind == "disabled-transition" else 4 if kind == "exit-time" else 0
    o += [
        obj(
            "StateTransition",
            stateToId=4,
            duration=400 if kind == "timed-transition" else 0,
            flags=flags,
            exitTime=500 if kind == "exit-time" else 0,
        ),
        obj("TransitionBoolCondition", inputId=0, opValue=0),
    ]
    if kind == "condition-conjunction":
        o.append(obj("TransitionNumberCondition", inputId=1, opValue=5, value=50))
    o += [
        obj("AnimationState", animationId=1),
        obj("StateTransition", stateToId=3),
        obj("TransitionBoolCondition", inputId=0, opValue=1),
    ]
    if kind == "pointer-enter-exit":
        o += [
            obj(
                "StateMachineListenerSingle",
                name="Enter",
                targetId=1,
                listenerTypeValue=0,
            ),
            obj("ListenerBoolChange", inputId=0, value=1),
            obj(
                "StateMachineListenerSingle",
                name="Exit",
                targetId=1,
                listenerTypeValue=1,
            ),
            obj("ListenerBoolChange", inputId=0, value=0),
        ]
    if kind == "pointer-number":
        o += [
            obj(
                "StateMachineListenerSingle",
                name="Click",
                targetId=1,
                listenerTypeValue=6,
            ),
            obj("ListenerNumberChange", inputId=1, value=75),
        ]
    return scene(kind, o)


def reentry(reset):
    o = (
        rect()
        + timeline("Idle", 1, 13, [(0, 64), (60, 64)])
        + timeline("Move", 1, 13, [(0, 64), (60, 192)])
    )
    # Once, so exit-time and restart are not confused with wrapping.
    for item in o:
        if item["type"] == 31:
            for p in item["properties"]:
                if p["key"] == 59:
                    p["value"] = 0
    o += [
        obj("StateMachine", name="Controller"),
        obj("StateMachineBool", name="active"),
        obj("StateMachineLayer"),
        obj("EntryState"),
        obj("StateTransition", stateToId=3),
        obj("AnyState"),
        obj("ExitState"),
        obj("AnimationState", animationId=0),
        obj("StateTransition", stateToId=4),
        obj("TransitionBoolCondition", inputId=0, opValue=0),
        obj("AnimationState", animationId=1, flags=2 if reset else 0),
        obj("StateTransition", stateToId=3),
        obj("TransitionBoolCondition", inputId=0, opValue=1),
    ]
    return scene("Reentry", o)


def feather_curve():
    d = curve()
    d["objects"][-2] = obj("Fill", parentId=1, fillRule=2)
    d["objects"].append(obj("Feather", parentId=7, strength=8))
    return d


def feather_hole():
    o = [obj("Shape", parentId=0)]
    contour(o, [(48, 48), (208, 48), (208, 208), (48, 208)])
    contour(o, [(96, 96), (96, 160), (160, 160), (160, 96)])
    fill = len(o) + 1
    o += [
        obj("Fill", parentId=1, fillRule=2),
        obj("SolidColor", parentId=fill, colorValue=0xFF2864DC),
        obj("Feather", parentId=fill, strength=8),
    ]
    return scene("FeatherHole", o)


def feather_gradient():
    o = rect(x=128, y=128, width=128, height=64)[:-1]
    o[2] = obj("Fill", parentId=1, fillRule=2)
    o += [
        obj("LinearGradient", parentId=3, startX=-64, startY=0, endX=64, endY=0),
        obj("GradientStop", parentId=4, colorValue=0xFFFF0000, position=0),
        obj("GradientStop", parentId=4, colorValue=0xFF0000FF, position=1),
        obj("Feather", parentId=3, strength=8),
    ]
    return scene("FeatherGradient", o)


def feather_stroke():
    o = [obj("Shape", parentId=0)]
    contour(o, [(64, 128), (128, 64), (192, 128)], closed=False)
    paint = len(o) + 1
    o += [
        obj("Stroke", parentId=1, thickness=12, cap=1, join=1),
        obj("SolidColor", parentId=paint, colorValue=0xFF2864DC),
        obj("Feather", parentId=paint, strength=8),
    ]
    return scene("FeatherStroke", o)


def binding():
    root = [
        obj("ViewModel", name="Model"),
        obj("ViewModelPropertyNumber", name="positionX"),
        obj("ViewModelPropertyNumber", name="width"),
        obj("ViewModelPropertyColor", name="color"),
        obj("ViewModelPropertyBoolean", name="active"),
        obj("ViewModelInstance", name="Default", viewModelId=0),
        obj("ViewModelInstanceNumber", viewModelPropertyId=0, propertyValue=64),
        obj("ViewModelInstanceNumber", viewModelPropertyId=1, propertyValue=48),
        obj("ViewModelInstanceColor", viewModelPropertyId=2, propertyValue=0xFF2864DC),
        obj("ViewModelInstanceBoolean", viewModelPropertyId=3),
    ]
    r = rect()
    o = [
        r[0],
        obj("DataBindContext", sourcePathIds="0000", propertyKey=13),
        r[1],
        obj("DataBindContext", sourcePathIds="0001", propertyKey=20),
        r[2],
        r[3],
        obj("DataBindContext", sourcePathIds="0002", propertyKey=37),
    ]
    o += timeline("Idle", 1, 14, [(0, 128), (60, 128)]) + timeline(
        "Active", 1, 14, [(0, 80), (60, 80)]
    )
    o += [
        obj("StateMachine", name="Controller"),
        obj("StateMachineLayer"),
        obj("EntryState"),
        obj("StateTransition", stateToId=3),
        obj("AnyState"),
        obj("ExitState"),
    ]
    for anim, to, val in [(0, 4, True), (1, 3, False)]:
        o += [
            obj("AnimationState", animationId=anim),
            obj("StateTransition", stateToId=to),
            obj("TransitionViewModelCondition"),
            obj("BindablePropertyBoolean"),
            obj("DataBindContext", sourcePathIds="0003", propertyKey=634),
            obj("TransitionPropertyViewModelComparator"),
            obj("TransitionValueBooleanComparator", value=val),
        ]
    o += [
        obj("StateMachineListenerSingle", targetId=1, listenerTypeValue=6),
        obj("BindablePropertyBoolean", propertyValue=True),
        obj("DataBindContext", sourcePathIds="0003", propertyKey=634, flags=1),
        obj("ListenerViewModelChange"),
    ]
    return {
        "major": 7,
        "minor": 0,
        "file_id": 0,
        "toc": {},
        "objects": [obj("Backboard")]
        + root
        + [
            obj(
                "Artboard",
                name="Binding",
                width=256,
                height=256,
                viewModelId=0,
                defaultStateMachineId=0,
            )
        ]
        + o,
    }


def fixtures():
    return {
        "data-binding": binding(),
        "weighted-mesh": mesh(),
        "weighted-mesh-rotation": rotated_mesh(),
        "plain-mesh": mesh(False),
        "invalid-mesh-index": mesh(False, True),
        **{
            n: controller(n)
            for n in [
                "timed-transition",
                "exit-time",
                "disabled-transition",
                "condition-conjunction",
                "pointer-enter-exit",
                "pointer-number",
            ]
        },
        "reentry-reset-flag": reentry(True),
        "reentry-default": reentry(False),
        "feather-curve": feather_curve(),
        "feather-hole": feather_hole(),
        "feather-gradient": feather_gradient(),
        "feather-stroke": feather_stroke(),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assets = ROOT / "research/rml/weighted-mesh"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "quadrants.png").write_bytes(texture())
    for name, doc in fixtures().items():
        data = write(doc)
        assert write(parse(data), True) == data
        (OUT / (name + ".riv")).write_bytes(data)
        (OUT / (name + ".json")).write_text(json.dumps(doc, indent=2) + "\n")
        print(name, len(data))


if __name__ == "__main__":
    main()
