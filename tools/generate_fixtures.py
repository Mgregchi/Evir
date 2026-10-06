"""Author fixtures from schema metadata, never from an editor-export template."""

import json
from pathlib import Path
from riv import obj, write, parse

OUT = Path(__file__).resolve().parents[1] / "research/fixtures"


def rect(
    parent=0, x=64, y=128, color=0xFF2864DC, start=1, name="Box", width=48, height=48
):
    return [
        obj("Shape", name=name, parentId=parent, x=x, y=y),
        obj("Rectangle", parentId=start, width=width, height=height),
        obj("Fill", parentId=start),
        obj("SolidColor", parentId=start + 2, colorValue=color),
    ]


def timeline(name, target, key, values):
    return [
        obj("LinearAnimation", name=name, fps=60, duration=60, loopValue=1),
        obj("KeyedObject", objectId=target),
        obj("KeyedProperty", propertyKey=key),
    ] + [
        obj("KeyFrameDouble", frame=f, interpolationType=1, value=v) for f, v in values
    ]


def scene(name, objects):
    return {
        "major": 7,
        "minor": 0,
        "file_id": 0,
        "toc": {},
        "objects": [obj("Backboard"), obj("Artboard", name=name, width=256, height=256)]
        + objects,
    }


def machine():
    return [
        obj("StateMachine", name="Controller"),
        obj("StateMachineBool", name="active", value=False),
        obj("StateMachineLayer", name="Main"),
        obj("EntryState"),
        obj("StateTransition", stateToId=3),
        obj("AnyState"),
        obj("ExitState"),
        obj("AnimationState", animationId=0),
        obj("StateTransition", stateToId=4, duration=0),
        obj("TransitionBoolCondition", inputId=0, opValue=0),
        obj("AnimationState", animationId=1),
        obj("StateTransition", stateToId=3, duration=0),
        obj("TransitionBoolCondition", inputId=0, opValue=1),
    ]


def fixtures():
    yield "static", scene("Static", rect())
    yield "animated", scene(
        "Animated", rect() + timeline("Move", 1, 13, [(0, 64), (30, 192), (60, 64)])
    )
    bones = (
        [
            obj("RootBone", name="Shoulder", parentId=0, x=80, y=128, length=60),
            obj("Bone", name="Elbow", parentId=1, length=60),
        ]
        + rect(parent=1, x=30, y=0, start=3, name="Upper arm", width=60, height=20)
        + rect(
            parent=2,
            x=30,
            y=0,
            start=7,
            name="Forearm",
            color=0xFFDC6428,
            width=60,
            height=16,
        )
    )
    bones += timeline("Wave", 1, 15, [(0, -0.5), (30, 0.5), (60, -0.5)]) + timeline(
        "Bend", 2, 15, [(0, 0.1), (30, 1.0), (60, 0.1)]
    )
    yield "bones", scene("Bones", bones)
    yield "state-machine", scene(
        "Interactive",
        rect()
        + timeline("Idle", 1, 13, [(0, 64), (60, 64)])
        + timeline("Active", 1, 13, [(0, 192), (60, 192)])
        + machine(),
    )
    # Same authored content, deliberately explicit defaults for a fair exporter-size experiment.
    compact = scene("Static", rect())
    verbose = scene("Static", rect())
    for o in verbose["objects"]:
        if o["type"] == 3:
            o["properties"] += obj(
                "Shape", rotation=0, scaleX=1, scaleY=1, opacity=1, blendModeValue=3
            )["properties"]
        if o["type"] == 7:
            o["properties"] += obj(
                "Rectangle",
                x=0,
                y=0,
                rotation=0,
                scaleX=1,
                scaleY=1,
                originX=0.5,
                originY=0.5,
                cornerRadiusTL=0,
            )["properties"]
    yield "static-explicit-defaults", verbose
    # Character-load stress fixture: 100 independently animated rectangles plus an interactive controller.
    objects = []
    for i in range(100):
        objects += rect(
            x=16 + (i % 10) * 24,
            y=16 + (i // 10) * 24,
            start=1 + 4 * i,
            name=f"Box{i}",
            width=12,
            height=12,
        )
    for i in range(100):
        objects += timeline(
            f"Move{i}", 1 + 4 * i, 15, [(0, -0.4), (30, 0.4), (60, -0.4)]
        )
    objects += machine()
    yield "stress-100", scene("Stress", objects)


def many_states(count):
    objects = rect()
    for i in range(count):
        objects += timeline(
            f"Pose{i}",
            1,
            13,
            [(0, 32 + 192 * i / (count - 1)), (60, 32 + 192 * i / (count - 1))],
        )
    objects += [
        obj("StateMachine", name="Selector"),
        obj("StateMachineNumber", name="target", value=0),
        obj("StateMachineLayer", name="Main"),
        obj("EntryState"),
        obj("StateTransition", stateToId=3),
        obj("AnyState"),
    ]
    for i in range(count):
        objects += [
            obj("StateTransition", stateToId=3 + i),
            obj("TransitionNumberCondition", inputId=0, opValue=0, value=float(i)),
        ]
    objects += [obj("ExitState")] + [
        obj("AnimationState", animationId=i) for i in range(count)
    ]
    return scene(f"States{count}", objects)


def characters(count):
    objects = []
    targets = []
    for i in range(count):
        base = 1 + 10 * i
        x = 24 + (i % 5) * 48
        y = 24 + (i // 5) * 48
        objects += [
            obj("RootBone", name=f"Root{i}", parentId=0, x=x, y=y, length=16),
            obj("Bone", parentId=base, length=16),
        ]
        objects += rect(
            parent=base, x=8, y=0, start=base + 2, name=f"Upper{i}", width=16, height=6
        )
        objects += rect(
            parent=base + 1,
            x=8,
            y=0,
            start=base + 6,
            name=f"Lower{i}",
            width=16,
            height=4,
            color=0xFFDC6428,
        )
        targets += [base, base + 1]
    for animation in ["Idle", "Dance"]:
        objects += [obj("LinearAnimation", name=animation, duration=60, loopValue=1)]
        for target in targets:
            objects += [
                obj("KeyedObject", objectId=target),
                obj("KeyedProperty", propertyKey=15),
            ]
            for f, v in [(0, -0.4), (30, 0.7), (60, -0.4)]:
                objects += [
                    obj(
                        "KeyFrameDouble",
                        frame=f,
                        interpolationType=1,
                        value=v if animation == "Dance" else 0,
                    )
                ]
    objects += machine()
    return scene("Characters", objects)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, d in (
        list(fixtures())
        + [(f"states-{n}", many_states(n)) for n in [2, 8, 32, 128]]
        + [("characters-25", characters(25))]
    ):
        data = write(d)
        (OUT / (name + ".riv")).write_bytes(data)
        (OUT / (name + ".json")).write_text(json.dumps(d, indent=2) + "\n")
        assert write(parse(data), True) == data
        print(name, len(data), "bytes", len(d["objects"]), "objects")


if __name__ == "__main__":
    main()
