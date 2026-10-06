"""Targeted semantic probes beyond the original compatibility slice."""

import json, math
from pathlib import Path
from riv import obj, write, parse
from generate_fixtures import rect, scene, timeline

OUT = Path(__file__).resolve().parents[1] / "research/fixtures/advanced"


def skin():
    o = [
        obj("RootBone", name="Fixed", parentId=0, x=0, y=0),
        obj("RootBone", name="Moving", parentId=0, x=0, y=0),
        obj("Shape", parentId=0),
        obj("PointsPath", parentId=3, isClosed=True),
    ]
    for x, y in [(64, 96), (128, 96), (192, 96), (192, 160), (128, 160), (64, 160)]:
        index = len(o) + 1
        o.append(obj("StraightVertex", parentId=4, x=x, y=y))
        indices, values = (
            (1, 255)
            if x == 64
            else (2, 255) if x == 192 else (1 | (2 << 8), 128 | (127 << 8))
        )
        o.append(obj("Weight", parentId=index, indices=indices, values=values))
    index = len(o) + 1
    o.append(obj("Skin", parentId=4, xx=1, yx=0, xy=0, yy=1, tx=0, ty=0))
    for bone in [1, 2]:
        o.append(
            obj(
                "Tendon",
                parentId=index,
                boneId=bone,
                xx=1,
                yx=0,
                xy=0,
                yy=1,
                tx=0,
                ty=0,
            )
        )
    fill = len(o) + 1
    o += [
        obj("Fill", parentId=3),
        obj("SolidColor", parentId=fill, colorValue=0xFF2864DC),
    ]
    o += timeline("Deform", 2, 91, [(0, 0), (30, 48), (60, 0)])
    return scene("Weighted", o)


def trigger():
    o = (
        rect()
        + timeline("Left", 1, 13, [(0, 64), (60, 64)])
        + timeline("Right", 1, 13, [(0, 192), (60, 192)])
    )
    o += [
        obj("StateMachine", name="Trigger"),
        obj("StateMachineTrigger", name="fire"),
        obj("StateMachineLayer"),
        obj("EntryState"),
        obj("StateTransition", stateToId=3),
        obj("AnyState"),
        obj("ExitState"),
    ]
    for state, to in [(0, 4), (1, 3)]:
        o += [
            obj("AnimationState", animationId=state),
            obj("StateTransition", stateToId=to),
            obj("TransitionTriggerCondition", inputId=0),
        ]
    return scene("Trigger", o)


def blend():
    o = (
        rect()
        + timeline("Left", 1, 13, [(0, 64), (60, 64)])
        + timeline("Right", 1, 13, [(0, 192), (60, 192)])
    )
    o += [
        obj("StateMachine", name="Blend"),
        obj("StateMachineNumber", name="mix", value=0),
        obj("StateMachineLayer"),
        obj("EntryState"),
        obj("StateTransition", stateToId=3),
        obj("AnyState"),
        obj("ExitState"),
        obj("BlendState1DInput", inputId=0, flags=2),
        obj("BlendAnimation1D", animationId=0, value=0),
        obj("BlendAnimation1D", animationId=1, value=1),
    ]
    return scene("Blend", o)


def curve():
    o = [obj("Shape", parentId=0), obj("PointsPath", parentId=1, isClosed=True)]
    k = 0.5522847498 * 64
    for x, y, inside, outside in [
        (192, 128, -math.pi / 2, math.pi / 2),
        (128, 192, 0, math.pi),
        (64, 128, math.pi / 2, -math.pi / 2),
        (128, 64, math.pi, 0),
    ]:
        o.append(
            obj(
                "CubicDetachedVertex",
                parentId=2,
                x=x,
                y=y,
                inRotation=inside,
                inDistance=k,
                outRotation=outside,
                outDistance=k,
            )
        )
    o += [obj("Fill", parentId=1), obj("SolidColor", parentId=7, colorValue=0xFF2864DC)]
    return scene("Curve", o)


def gradient():
    o = rect(x=128, y=128, width=128, height=64)[:-1]
    o += [
        obj("LinearGradient", parentId=3, startX=-64, startY=0, endX=64, endY=0),
        obj("GradientStop", parentId=4, colorValue=0xFFFF0000, position=0),
        obj("GradientStop", parentId=4, colorValue=0xFF0000FF, position=1),
    ]
    return scene("Gradient", o)


def clipping():
    o = [obj("Node", name="Group", parentId=0)] + rect(
        parent=1, start=2, x=128, y=128, width=128, height=128
    )
    o += [
        obj("Shape", name="Mask", parentId=0),
        obj("Rectangle", parentId=6, width=64, height=64, x=128, y=128),
        obj("ClippingShape", parentId=1, sourceId=6),
    ]
    return scene("Clip", o)


def feather():
    o = rect(x=128, y=128, width=64, height=64)
    # RiveRenderer::drawPath skips feathered fills under any other rule.
    o[2] = obj("Fill", parentId=1, fillRule=2)
    return scene(
        "Feather",
        o + [obj("Feather", parentId=3, strength=12)],
    )


def listener():
    d = trigger()
    o = d["objects"]
    o += [
        obj("StateMachineListener", name="Click", targetId=1),
        obj("ListenerInputType", listenerTypeValue=2),
        obj("ListenerTriggerChange", inputId=0),
    ]
    return d


def fixtures():
    return {
        "weighted-skin": skin(),
        "trigger": trigger(),
        "blend": blend(),
        "listener": listener(),
        "curve": curve(),
        "gradient": gradient(),
        "clip": clipping(),
        "feather": feather(),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, doc in fixtures().items():
        data = write(doc)
        assert write(parse(data), True) == data
        (OUT / (name + ".riv")).write_bytes(data)
        (OUT / (name + ".json")).write_text(json.dumps(doc, indent=2) + "\n")
        print(name, len(data))


if __name__ == "__main__":
    main()
