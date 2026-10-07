"""Small, independent cases for winding, compositing, clip stacks and blending."""

import json
from pathlib import Path
from riv import obj, write, parse
from generate_fixtures import rect, scene, timeline

OUT = Path(__file__).resolve().parents[1] / "research/fixtures/complex"


def contour(objects, points, parent=1, closed=True):
    index = len(objects) + 1
    objects.append(obj("PointsPath", parentId=parent, isClosed=closed))
    objects.extend(obj("StraightVertex", parentId=index, x=x, y=y) for x, y in points)


def winding(rule, reverse=False):
    o = [obj("Shape", parentId=0)]
    contour(o, [(48, 48), (208, 48), (208, 208), (48, 208)])
    inner = [(96, 96), (160, 96), (160, 160), (96, 160)]
    contour(o, inner[::-1] if reverse else inner)
    fill = len(o) + 1
    o += [
        obj("Fill", parentId=1, fillRule=rule),
        obj("SolidColor", parentId=fill, colorValue=0xFF2864DC),
    ]
    return scene("Winding", o)


def overlap(reverse=False):
    colors = [0x80FF0000, 0x800000FF]
    if reverse:
        colors.reverse()
    return scene(
        "Overlap",
        rect(x=104, width=96, height=96, color=colors[0])
        + rect(start=5, x=152, width=96, height=96, color=colors[1]),
    )


def nested_clip():
    o = [obj("Node", parentId=0), obj("Node", parentId=1)]
    o += rect(parent=2, start=3, x=128, width=160, height=160)
    o += [
        obj("Shape", parentId=0),
        obj("Rectangle", parentId=7, x=128, y=128, width=96, height=160),
    ]
    o += [
        obj("Shape", parentId=0),
        obj("Rectangle", parentId=9, x=128, y=128, width=160, height=64),
    ]
    o += [
        obj("ClippingShape", parentId=1, sourceId=7),
        obj("ClippingShape", parentId=2, sourceId=9),
    ]
    return scene("NestedClip", o)


def stroke():
    o = [obj("Shape", parentId=0)]
    contour(o, [(64, 128), (192, 128)], closed=False)
    o += [
        obj("Stroke", parentId=1, thickness=16, cap=1),
        obj("SolidColor", parentId=5, colorValue=0xFF2864DC),
    ]
    return scene("Stroke", o)


def radial():
    o = rect(x=128, width=128, height=128)[:-1]
    o += [
        obj("RadialGradient", parentId=3, startX=0, startY=0, endX=64, endY=0),
        obj("GradientStop", parentId=4, colorValue=0xFFFF0000, position=0),
        obj("GradientStop", parentId=4, colorValue=0xFF0000FF, position=1),
    ]
    return scene("Radial", o)


def direct_blend():
    o = (
        rect()
        + timeline("Left", 1, 13, [(0, 64), (60, 64)])
        + timeline("Right", 1, 13, [(0, 192), (60, 192)])
    )
    o += [
        obj("StateMachine", name="Direct"),
        obj("StateMachineNumber", name="left", value=100),
        obj("StateMachineNumber", name="right", value=0),
        obj("StateMachineLayer"),
        obj("EntryState"),
        obj("StateTransition", stateToId=3),
        obj("AnyState"),
        obj("ExitState"),
        obj("BlendStateDirect", flags=2),
        obj("BlendAnimationDirect", animationId=0, inputId=0),
        obj("BlendAnimationDirect", animationId=1, inputId=1),
    ]
    return scene("DirectBlend", o)


def layered():
    o = (
        rect()
        + timeline("X", 1, 13, [(0, 160), (60, 160)])
        + timeline("Y", 1, 14, [(0, 80), (60, 80)])
    )
    o.append(obj("StateMachine", name="Layers"))
    for animation in [0, 1]:
        o += [
            obj("StateMachineLayer", name=f"Layer{animation}"),
            obj("EntryState"),
            obj("StateTransition", stateToId=3),
            obj("AnyState"),
            obj("ExitState"),
            obj("AnimationState", animationId=animation),
        ]
    return scene("Layers", o)


def feather_control(strength, rule=0, **options):
    o = rect(x=128, y=128, width=64, height=64)
    o[2] = obj("Fill", parentId=1, fillRule=rule)
    o.append(obj("Feather", parentId=3, strength=strength, **options))
    return scene("FeatherControl", o)


def fixtures():
    cases = {
        "nonzero-same": winding(0),
        "nonzero-opposite": winding(0, True),
        "evenodd-same": winding(1),
        "evenodd-opposite": winding(1, True),
        "overlap-red-blue": overlap(),
        "overlap-blue-red": overlap(True),
        "nested-clip": nested_clip(),
        "round-stroke": stroke(),
        "radial-gradient": radial(),
        "direct-blend": direct_blend(),
        "layers": layered(),
        "feather-zero": feather_control(0),
        "feather-one": feather_control(1),
        "feather-four": feather_control(4),
        "feather-clockwise": feather_control(12, 2),
        "feather-inner": feather_control(12, 2, inner=True),
        "feather-offset": feather_control(12, 2, offsetX=16),
    }
    o = [obj("Shape", parentId=0)]
    contour(o, [(64, 64), (192, 192), (64, 192), (192, 64)])
    o += [
        obj("Fill", parentId=1, fillRule=1),
        obj("SolidColor", parentId=7, colorValue=0xFF2864DC),
    ]
    cases["self-intersection"] = scene("BowTie", o)
    o = [obj("Node", parentId=0)] + rect(parent=1, start=2, x=128, width=64, height=64)
    o[3] = obj("Fill", parentId=2, fillRule=2)
    o += [
        obj("Shape", parentId=0),
        obj("Rectangle", parentId=6, x=128, y=128, width=64, height=64),
        obj("ClippingShape", parentId=1, sourceId=6),
        obj("Feather", parentId=4, strength=12),
    ]
    cases["feather-clip"] = scene("FeatherClip", o)
    return cases


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, doc in fixtures().items():
        data = write(doc)
        assert write(parse(data), True) == data
        (OUT / (name + ".riv")).write_bytes(data)
        (OUT / (name + ".json")).write_text(json.dumps(doc, indent=2) + "\n")
        print(name, len(data))
