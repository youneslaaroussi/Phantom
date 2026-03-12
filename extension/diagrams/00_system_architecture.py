#!/usr/bin/env python3
"""Phantom System Architecture"""

from graphviz import Digraph

dot = Digraph('Architecture', comment='Phantom System Architecture')
dot.attr(rankdir='TB', bgcolor='white', fontname='Comic Sans MS',
         fontcolor='#000000', dpi='300', splines='curved',
         nodesep='1.0', ranksep='1.2', pad='0.5')
dot.attr('node', shape='box', style='rounded,filled', fontname='Comic Sans MS',
         fontsize='13', penwidth='2', margin='0.3,0.2',
         fillcolor='#fffef7', color='#2c3e50')
dot.attr('edge', fontname='Comic Sans MS', fontsize='11',
         fontcolor='#2c3e50', penwidth='2', color='#2c3e50')

# === USER INPUT ===
with dot.subgraph(name='cluster_input') as c:
    c.attr(label='USER INPUT', style='rounded,filled',
           fillcolor='#f0f4f8', color='#2c3e50',
           fontsize='14', penwidth='2.5', margin='20')
    c.node('voice', 'Voice\n(Microphone)')
    c.node('text', 'Text\n(Keyboard)')

# === CHROME EXTENSION ===
with dot.subgraph(name='cluster_ext') as c:
    c.attr(label='CHROME EXTENSION (Plasmo)', style='rounded,filled',
           fillcolor='#e8f5e9', color='#2c3e50',
           fontsize='14', penwidth='2.5', margin='20')
    c.node('session', 'Session\nProvider', fillcolor='#c8e6c9', fontsize='14', width='2')
    c.node('audio_capture', 'Audio\nCapture', fillcolor='#c8e6c9')
    c.node('audio_playback', 'Audio\nPlayback', fillcolor='#c8e6c9')
    c.node('vision', 'Vision\nModule', fillcolor='#a5d6a7')
    c.node('tools', 'Tool\nExecutor', fillcolor='#c8e6c9')

# === CONNECTION LAYER ===
with dot.subgraph(name='cluster_conn') as c:
    c.attr(label='CONNECTION', style='rounded,filled',
           fillcolor='#f3e5f5', color='#2c3e50',
           fontsize='14', penwidth='2.5', margin='20')
    c.node('mode_switch', 'Mode\nSwitch', fillcolor='#ce93d8',
           shape='diamond', width='2')
    c.node('direct', 'Direct\n(BYOK)', fillcolor='#e1bee7')
    c.node('proxy', 'Cloud Run\nProxy', fillcolor='#e1bee7')

# === GEMINI LIVE ===
dot.node('gemini', 'GEMINI LIVE API\n━━━━━━━━━━━━━\ngemini-2.0-flash-exp\nBidirectional WebSocket', 
         fillcolor='#bbdefb', penwidth='3', fontsize='15', width='3.5')

# === BROWSER TOOLS ===
with dot.subgraph(name='cluster_tools') as c:
    c.attr(label='BROWSER TOOLS (12)', style='rounded,filled',
           fillcolor='#fff3e0', color='#2c3e50',
           fontsize='14', penwidth='2.5', margin='20')
    c.node('nav_tools', 'Navigation\nopenTab · getTabs\nswitchTab · getPageTitle', fillcolor='#ffe0b2')
    c.node('interact_tools', 'Interaction\nclickElement · fillInput\npressKey', fillcolor='#ffe0b2')
    c.node('inspect_tools', 'Inspection\ncaptureScreenshot\ngetAccessibilitySnapshot\nfindElements', fillcolor='#ffe0b2')
    c.node('scroll_tools', 'Scrolling\nscrollUp · scrollDown', fillcolor='#ffe0b2')

# === VISION ===
dot.node('tab_capture', 'Tab Capture\nJPEG @ 3s intervals\nChange Detection', 
         fillcolor='#ffcdd2', shape='note')
dot.node('indicator', 'Page Indicator\n"Phantom is watching"', 
         fillcolor='#ffcdd2', shape='note')

# === WEBPAGE ===
dot.node('webpage', 'Active Tab\n(Any Website)',
         fillcolor='#e0e0e0', penwidth='3', fontsize='14', width='2.5')

# === OUTPUT ===
with dot.subgraph(name='cluster_output') as c:
    c.attr(label='OUTPUT', style='rounded,filled',
           fillcolor='#e3f2fd', color='#2c3e50',
           fontsize='14', penwidth='2.5', margin='20')
    c.node('speech', 'Speech\n(Speaker)')
    c.node('wave', 'WebGL\nVisualizer')

# === EDGES ===

# User input
dot.edge('voice', 'audio_capture', penwidth='2')
dot.edge('text', 'session', penwidth='2')
dot.edge('audio_capture', 'session', label='PCM audio', penwidth='2')

# Session to connection
dot.edge('session', 'mode_switch', penwidth='3', color='#1976d2')
dot.edge('mode_switch', 'direct', label='BYOK', penwidth='2')
dot.edge('mode_switch', 'proxy', label='hosted', penwidth='2')
dot.edge('direct', 'gemini', penwidth='3')
dot.edge('proxy', 'gemini', penwidth='3')

# Gemini response
dot.edge('gemini', 'session', label='audio + function calls', penwidth='3', color='#1976d2')

# Audio output
dot.edge('session', 'audio_playback', label='audio', penwidth='2')
dot.edge('audio_playback', 'speech', penwidth='2')
dot.edge('audio_playback', 'wave', label='level', style='dashed', penwidth='2')

# Tool execution
dot.edge('session', 'tools', label='function_call', penwidth='3')
dot.edge('tools', 'nav_tools', penwidth='2')
dot.edge('tools', 'interact_tools', penwidth='2')
dot.edge('tools', 'inspect_tools', penwidth='2')
dot.edge('tools', 'scroll_tools', penwidth='2')
dot.edge('tools', 'session', label='tool_response', color='#c62828', penwidth='3')

# Tools to webpage
dot.edge('interact_tools', 'webpage', label='DOM', penwidth='2')
dot.edge('inspect_tools', 'webpage', label='capture', style='dashed', penwidth='2')
dot.edge('scroll_tools', 'webpage', penwidth='2')

# Vision
dot.edge('vision', 'tab_capture', penwidth='2')
dot.edge('tab_capture', 'webpage', label='captureVisibleTab', style='dashed', penwidth='2')
dot.edge('vision', 'indicator', penwidth='2')
dot.edge('indicator', 'webpage', label='inject', style='dashed', penwidth='2')
dot.edge('vision', 'session', label='JPEG frames', color='#c62828', penwidth='3')

dot.render('system_architecture', format='png', cleanup=True)
print("✅ system_architecture.png")
