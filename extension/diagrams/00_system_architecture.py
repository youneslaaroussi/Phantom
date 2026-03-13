#!/usr/bin/env python3
"""Phantom System Architecture"""

from graphviz import Digraph
from nodes import add_nodes
from edges import add_edges

dot = Digraph("Architecture", comment="Phantom System Architecture")
dot.attr(
    rankdir="TB",
    bgcolor="#0a0a12",
    fontname="Helvetica",
    fontcolor="#e2e8f0",
    dpi="300",
    splines="curved",
    nodesep="1.0",
    ranksep="1.2",
    pad="0.5",
)
dot.attr(
    "node",
    shape="box",
    style="rounded,filled",
    fontname="Helvetica",
    fontsize="12",
    penwidth="1.5",
    margin="0.3,0.2",
    fillcolor="#1e1b4b",
    color="#6366f1",
    fontcolor="#e2e8f0",
)
dot.attr(
    "edge",
    fontname="Helvetica",
    fontsize="10",
    fontcolor="#94a3b8",
    penwidth="1.5",
    color="#6366f1",
)

add_nodes(dot)
add_edges(dot)

dot.render("system_architecture", format="png", cleanup=True)
print("system_architecture.png")
