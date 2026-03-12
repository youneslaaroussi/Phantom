#!/usr/bin/env python3
"""Gemini Live Session — bidirectional audio + function calling"""

from graphviz import Digraph

dot = Digraph('LiveSession', comment='Live Session Flow')
dot.attr(rankdir='LR', bgcolor='white', fontname='Comic Sans MS',
         fontcolor='#2c3e50', dpi='300', splines='curved')
dot.attr('node', shape='box', style='rounded,filled', fontname='Comic Sans MS',
         fontsize='14', penwidth='2', margin='0.3,0.2',
         fillcolor='#fffef7', color='#2c3e50')
dot.attr('edge', fontname='Comic Sans MS', fontsize='12',
         fontcolor='#2c3e50', penwidth='2', color='#2c3e50')

dot.node('user', 'User\nSpeaks', fillcolor='#ffcdd2', width='1.5')
dot.node('mic', 'Microphone\n(AudioWorklet)', fillcolor='#e3f2fd', width='2')
dot.node('ws', 'WebSocket\n━━━━━━━━\nBidirectional', fillcolor='#bbdefb', width='2', penwidth='3')
dot.node('gemini', 'Gemini Live\n━━━━━━━━━\n2.0-flash-exp', fillcolor='#bbdefb', width='2', penwidth='3')

dot.node('audio_out', 'Audio\nPlayback', fillcolor='#c8e6c9', width='2')
dot.node('func_call', 'Function\nCall', fillcolor='#ce93d8', width='2')
dot.node('tool_exec', 'Execute\nTool', fillcolor='#e1bee7', width='2')
dot.node('tool_resp', 'Tool\nResponse', fillcolor='#ffcdd2', width='2')

# Forward path
dot.edge('user', 'mic', label='voice', penwidth='2')
dot.edge('mic', 'ws', label='PCM 16kHz', penwidth='3', color='#1976d2')
dot.edge('ws', 'gemini', label='realtimeInput', penwidth='3', color='#1976d2')

# Response paths
dot.edge('gemini', 'ws', label='serverContent', penwidth='3', color='#2e7d32')
dot.edge('ws', 'audio_out', label='audio chunks', penwidth='2', color='#2e7d32')
dot.edge('ws', 'func_call', label='toolCall', penwidth='2', color='#7b1fa2')

# Tool loop
dot.edge('func_call', 'tool_exec', label='dispatch', penwidth='2')
dot.edge('tool_exec', 'tool_resp', label='result', penwidth='2')
dot.edge('tool_resp', 'ws', label='toolResponse', color='#c62828', penwidth='3')

dot.render('live_session', format='png', cleanup=True)
print("✅ live_session.png")
