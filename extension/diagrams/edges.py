"""Edge definitions for Phantom architecture diagram"""


def add_edges(dot):
    _input_edges(dot)
    _session_edges(dot)
    _connection_edges(dot)
    _output_edges(dot)
    _tool_edges(dot)
    _vision_edges(dot)
    _persona_edges(dot)
    _sound_edges(dot)


def _input_edges(dot):
    dot.edge("voice", "audio_capture", penwidth="2")
    dot.edge("text", "session", penwidth="2")
    dot.edge("audio_capture", "session", label="PCM 16kHz", penwidth="2")


def _session_edges(dot):
    dot.edge("session", "mode_switch", penwidth="3", color="#67e8f9")
    dot.edge("session", "trace", style="dashed", color="#475569")
    dot.edge("session", "sounds", style="dashed", color="#475569")


def _connection_edges(dot):
    dot.edge("mode_switch", "direct", label="BYOK", penwidth="2", color="#a855f7")
    dot.edge("mode_switch", "proxy", label="hosted", penwidth="2", color="#a855f7")
    dot.edge("direct", "gemini", penwidth="3", color="#67e8f9")
    dot.edge("proxy", "gemini", penwidth="3", color="#67e8f9")
    dot.edge(
        "gemini", "session", label="audio + tool calls", penwidth="3", color="#67e8f9"
    )


def _output_edges(dot):
    dot.edge("session", "audio_playback", label="audio", penwidth="2")
    dot.edge("audio_playback", "speech", penwidth="2")
    dot.edge("audio_playback", "wave", label="level", style="dashed")
    dot.edge("session", "mascot", label="state", style="dashed", color="#ec4899")


def _tool_edges(dot):
    dot.edge("session", "tools", label="function_call", penwidth="3", color="#f59e0b")
    dot.edge("tools", "nav_tools", penwidth="2", color="#f59e0b")
    dot.edge("tools", "interact_tools", penwidth="2", color="#f59e0b")
    dot.edge("tools", "scroll_tools", penwidth="2", color="#f59e0b")
    dot.edge("tools", "inspect_tools", penwidth="2", color="#f59e0b")
    dot.edge("tools", "session", label="tool_response", color="#f59e0b", penwidth="3")
    dot.edge("interact_tools", "webpage", label="DOM", penwidth="2", color="#94a3b8")
    dot.edge("scroll_tools", "webpage", penwidth="2", color="#94a3b8")
    dot.edge(
        "inspect_tools", "webpage", label="a11y tree", style="dashed", color="#94a3b8"
    )


def _vision_edges(dot):
    dot.edge(
        "vision", "webpage", label="captureVisibleTab", style="dashed", color="#f43f5e"
    )
    dot.edge(
        "wisp_indicator", "webpage", label="inject", style="dashed", color="#f43f5e"
    )
    dot.edge("vision", "session", label="JPEG frames", color="#f43f5e", penwidth="3")
    dot.edge("vision", "wisp_indicator", color="#f43f5e")


def _persona_edges(dot):
    dot.edge(
        "persona", "session", label="voice + prompt", penwidth="2", color="#ec4899"
    )


def _sound_edges(dot):
    dot.edge("sounds", "tools", label="SFX", style="dashed", color="#475569")
