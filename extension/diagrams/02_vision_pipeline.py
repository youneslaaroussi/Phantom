#!/usr/bin/env python3
"""Vision Pipeline — screen capture and streaming"""

from graphviz import Digraph

dot = Digraph('Vision', comment='Vision Pipeline')
dot.attr(rankdir='TB', bgcolor='white', fontname='Comic Sans MS',
         fontcolor='#2c3e50', dpi='300', splines='curved',
         nodesep='0.8', ranksep='1.0')
dot.attr('node', shape='box', style='rounded,filled', fontname='Comic Sans MS',
         fontsize='13', penwidth='2', margin='0.3,0.2',
         fillcolor='#fffef7', color='#2c3e50')
dot.attr('edge', fontname='Comic Sans MS', fontsize='11',
         fontcolor='#2c3e50', penwidth='2', color='#2c3e50')

dot.node('toggle', 'Eye Toggle\n(User)', fillcolor='#e3f2fd', shape='diamond', width='2')
dot.node('timer', 'Interval Timer\nevery 3 seconds', fillcolor='#e3f2fd')
dot.node('capture', 'chrome.tabs\n.captureVisibleTab()', fillcolor='#bbdefb', width='2.5')
dot.node('jpeg', 'JPEG Encode\n50% quality', fillcolor='#c8e6c9')
dot.node('diff', 'Change\nDetection', fillcolor='#fff3e0', shape='diamond', width='2')
dot.node('send', 'sendImage()\nto Live Session', fillcolor='#ce93d8', penwidth='3')
dot.node('skip', 'Skip Frame\n(no change)', fillcolor='#e0e0e0')
dot.node('indicator', 'Inject Indicator\n"Phantom is watching"', fillcolor='#ffcdd2')
dot.node('tab_switch', 'Active Tab\nChanged?', fillcolor='#fff3e0', shape='diamond', width='2')
dot.node('move', 'Move Indicator\nto New Tab', fillcolor='#ffcdd2')

# Flow
dot.edge('toggle', 'timer', label='ON', penwidth='2', color='#2e7d32')
dot.edge('toggle', 'indicator', label='ON', penwidth='2', color='#2e7d32')
dot.edge('timer', 'capture', penwidth='2')
dot.edge('capture', 'jpeg', penwidth='2')
dot.edge('jpeg', 'diff', penwidth='2')
dot.edge('diff', 'send', label='changed', penwidth='3', color='#1976d2')
dot.edge('diff', 'skip', label='same', style='dashed', penwidth='2')
dot.edge('capture', 'tab_switch', style='dashed', penwidth='2')
dot.edge('tab_switch', 'move', label='yes', penwidth='2')

# Off
dot.edge('toggle', 'skip', label='OFF', style='dashed', color='#c62828', penwidth='2')

dot.render('vision_pipeline', format='png', cleanup=True)
print("✅ vision_pipeline.png")
