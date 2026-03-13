"""Node definitions for Phantom architecture diagram"""


def add_nodes(dot):
    _input_nodes(dot)
    _extension_nodes(dot)
    _connection_nodes(dot)
    _gemini_node(dot)
    _tool_nodes(dot)
    _vision_nodes(dot)
    _persona_nodes(dot)
    _output_nodes(dot)
    _webpage_node(dot)


def _input_nodes(dot):
    with dot.subgraph(name="cluster_input") as c:
        c.attr(
            label="USER INPUT",
            style="rounded,filled",
            fillcolor="#1a1744",
            color="#6366f1",
            fontsize="13",
            fontcolor="#a5b4fc",
            penwidth="2",
            margin="20",
        )
        c.node("voice", "Voice\n(Microphone)", fillcolor="#312e81")
        c.node("text", "Text\n(Keyboard)", fillcolor="#312e81")


def _extension_nodes(dot):
    with dot.subgraph(name="cluster_ext") as c:
        c.attr(
            label="CHROME EXTENSION (Plasmo)",
            style="rounded,filled",
            fillcolor="#0f172a",
            color="#67e8f9",
            fontsize="13",
            fontcolor="#67e8f9",
            penwidth="2",
            margin="20",
        )
        c.node(
            "session",
            "Session\nProvider",
            fillcolor="#164e63",
            color="#67e8f9",
            width="2",
        )
        c.node("audio_capture", "Audio\nCapture", fillcolor="#164e63", color="#67e8f9")
        c.node(
            "audio_playback", "Audio\nPlayback", fillcolor="#164e63", color="#67e8f9"
        )
        c.node("tools", "Tool\nExecutor", fillcolor="#164e63", color="#67e8f9")
        c.node("trace", "Trace\nLogger", fillcolor="#1e293b", color="#475569")
        c.node("sounds", "Sound\nEngine", fillcolor="#1e293b", color="#475569")


def _connection_nodes(dot):
    with dot.subgraph(name="cluster_conn") as c:
        c.attr(
            label="CONNECTION",
            style="rounded,filled",
            fillcolor="#1a1744",
            color="#a855f7",
            fontsize="13",
            fontcolor="#c084fc",
            penwidth="2",
            margin="20",
        )
        c.node(
            "mode_switch",
            "Mode\nSwitch",
            fillcolor="#581c87",
            color="#a855f7",
            shape="diamond",
            width="2",
        )
        c.node("direct", "Direct\n(BYOK)", fillcolor="#3b0764", color="#a855f7")
        c.node("proxy", "Cloud Run\nProxy", fillcolor="#3b0764", color="#a855f7")


def _gemini_node(dot):
    dot.node(
        "gemini",
        "GEMINI LIVE API\ngemini-2.5-flash\nBidirectional WebSocket",
        fillcolor="#1e3a5f",
        color="#67e8f9",
        penwidth="3",
        fontsize="14",
        width="3.5",
        fontcolor="#67e8f9",
    )


def _tool_nodes(dot):
    with dot.subgraph(name="cluster_tools") as c:
        c.attr(
            label="BROWSER TOOLS",
            style="rounded,filled",
            fillcolor="#1c1917",
            color="#f59e0b",
            fontsize="13",
            fontcolor="#fbbf24",
            penwidth="2",
            margin="20",
        )
        c.node(
            "nav_tools",
            "Navigation\nopenTab / getTabs\nswitchTab / getPageTitle",
            fillcolor="#451a03",
            color="#f59e0b",
            fontcolor="#fde68a",
        )
        c.node(
            "interact_tools",
            "Interaction\nclickOn / typeInto\npressKey / highlight",
            fillcolor="#451a03",
            color="#f59e0b",
            fontcolor="#fde68a",
        )
        c.node(
            "scroll_tools",
            "Scroll & Find\nscrollDown / scrollUp\nscrollToElement",
            fillcolor="#451a03",
            color="#f59e0b",
            fontcolor="#fde68a",
        )
        c.node(
            "inspect_tools",
            "Inspection\ngetAccessibilitySnapshot\nfindElements",
            fillcolor="#451a03",
            color="#f59e0b",
            fontcolor="#fde68a",
        )


def _vision_nodes(dot):
    dot.node(
        "vision",
        "Vision Module\n1 FPS screen stream",
        fillcolor="#1e293b",
        color="#f43f5e",
        fontcolor="#fda4af",
        shape="note",
    )
    dot.node(
        "wisp_indicator",
        "Wisp Indicator\n(follows cursor)",
        fillcolor="#1e293b",
        color="#f43f5e",
        fontcolor="#fda4af",
        shape="note",
    )


def _persona_nodes(dot):
    with dot.subgraph(name="cluster_persona") as c:
        c.attr(
            label="PERSONAS (8)",
            style="rounded,filled",
            fillcolor="#1a1744",
            color="#ec4899",
            fontsize="13",
            fontcolor="#f472b6",
            penwidth="2",
            margin="20",
        )
        c.node(
            "persona",
            "Persona System\nimage + voice + prompt",
            fillcolor="#831843",
            color="#ec4899",
            fontcolor="#fbcfe8",
            width="2.5",
        )


def _output_nodes(dot):
    with dot.subgraph(name="cluster_output") as c:
        c.attr(
            label="OUTPUT",
            style="rounded,filled",
            fillcolor="#0f172a",
            color="#67e8f9",
            fontsize="13",
            fontcolor="#67e8f9",
            penwidth="2",
            margin="20",
        )
        c.node("speech", "Speech\n(Speaker)", fillcolor="#164e63", color="#67e8f9")
        c.node("wave", "WebGL\nWaveform", fillcolor="#164e63", color="#67e8f9")
        c.node("mascot", "Animated\nMascot", fillcolor="#164e63", color="#67e8f9")


def _webpage_node(dot):
    dot.node(
        "webpage",
        "Active Tab\n(Any Website)",
        fillcolor="#1e293b",
        color="#94a3b8",
        penwidth="3",
        fontsize="13",
        width="2.5",
        fontcolor="#e2e8f0",
    )
