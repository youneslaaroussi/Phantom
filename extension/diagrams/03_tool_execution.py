#!/usr/bin/env python3
"""Tool Execution — browser automation via function calling"""

from graphviz import Digraph

dot = Digraph('Tools', comment='Tool Execution Flow')
dot.attr(rankdir='TB', bgcolor='white', fontname='Comic Sans MS',
         fontcolor='#2c3e50', dpi='300', splines='curved',
         nodesep='0.8', ranksep='1.0')
dot.attr('node', shape='box', style='rounded,filled', fontname='Comic Sans MS',
         fontsize='13', penwidth='2', margin='0.3,0.2',
         fillcolor='#fffef7', color='#2c3e50')
dot.attr('edge', fontname='Comic Sans MS', fontsize='11',
         fontcolor='#2c3e50', penwidth='2', color='#2c3e50')

dot.node('gemini', 'Gemini Live\nFunction Call', fillcolor='#bbdefb', penwidth='3', width='2.5')
dot.node('dispatch', 'Tool\nDispatcher', fillcolor='#ce93d8', shape='diamond', width='2')

# Tool categories
with dot.subgraph(name='cluster_nav') as c:
    c.attr(label='Navigation', style='rounded,filled',
           fillcolor='#e3f2fd', color='#2c3e50', fontsize='12', margin='15')
    c.node('getPageTitle', 'getPageTitle', fillcolor='#bbdefb')
    c.node('openTab', 'openTab', fillcolor='#bbdefb')
    c.node('getTabs', 'getTabs', fillcolor='#bbdefb')
    c.node('switchTab', 'switchTab', fillcolor='#bbdefb')

with dot.subgraph(name='cluster_interact') as c:
    c.attr(label='Interaction', style='rounded,filled',
           fillcolor='#e8f5e9', color='#2c3e50', fontsize='12', margin='15')
    c.node('clickElement', 'clickElement', fillcolor='#c8e6c9')
    c.node('fillInput', 'fillInput', fillcolor='#c8e6c9')
    c.node('pressKey', 'pressKey', fillcolor='#c8e6c9')
    c.node('scrollDown', 'scrollDown', fillcolor='#c8e6c9')
    c.node('scrollUp', 'scrollUp', fillcolor='#c8e6c9')

with dot.subgraph(name='cluster_inspect') as c:
    c.attr(label='Inspection', style='rounded,filled',
           fillcolor='#fff3e0', color='#2c3e50', fontsize='12', margin='15')
    c.node('captureScreenshot', 'captureScreenshot', fillcolor='#ffe0b2')
    c.node('getA11y', 'getAccessibility\nSnapshot', fillcolor='#ffe0b2')
    c.node('findElements', 'findElements', fillcolor='#ffe0b2')

dot.node('chrome_api', 'Chrome APIs\n━━━━━━━━━━\ntabs · scripting\ntabCapture', 
         fillcolor='#e0e0e0', width='2.5')
dot.node('result', 'Tool Response\n→ Gemini', fillcolor='#ffcdd2', penwidth='3', width='2')

# Edges
dot.edge('gemini', 'dispatch', penwidth='3')
for tool in ['getPageTitle', 'openTab', 'getTabs', 'switchTab',
             'clickElement', 'fillInput', 'pressKey', 'scrollDown', 'scrollUp',
             'captureScreenshot', 'getA11y', 'findElements']:
    dot.edge('dispatch', tool, penwidth='1.5')

for tool in ['getPageTitle', 'openTab', 'getTabs', 'switchTab']:
    dot.edge(tool, 'chrome_api', penwidth='1.5')
for tool in ['clickElement', 'fillInput', 'pressKey', 'scrollDown', 'scrollUp']:
    dot.edge(tool, 'chrome_api', penwidth='1.5')
for tool in ['captureScreenshot', 'getA11y', 'findElements']:
    dot.edge(tool, 'chrome_api', penwidth='1.5')

dot.edge('chrome_api', 'result', penwidth='3')
dot.edge('result', 'gemini', label='LOOPBACK', color='#c62828', penwidth='4')

dot.render('tool_execution', format='png', cleanup=True)
print("✅ tool_execution.png")
