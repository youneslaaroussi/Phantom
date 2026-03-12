#!/usr/bin/env python3
"""Connection Modes — hosted proxy vs BYOK"""

from graphviz import Digraph

dot = Digraph('Connection', comment='Connection Modes')
dot.attr(rankdir='LR', bgcolor='white', fontname='Comic Sans MS',
         fontcolor='#2c3e50', dpi='300', splines='curved')
dot.attr('node', shape='box', style='rounded,filled', fontname='Comic Sans MS',
         fontsize='14', penwidth='2', margin='0.3,0.2',
         fillcolor='#fffef7', color='#2c3e50')
dot.attr('edge', fontname='Comic Sans MS', fontsize='12',
         fontcolor='#2c3e50', penwidth='2', color='#2c3e50')

dot.node('ext', 'Phantom\nExtension', fillcolor='#bbdefb', penwidth='3', width='2')
dot.node('choice', 'Mode?', fillcolor='#fff3e0', shape='diamond', width='1.5')

# BYOK path
dot.node('byok_ws', 'Direct WebSocket\nwss://generativelanguage\n.googleapis.com/ws/...', 
         fillcolor='#c8e6c9', width='3')

# Hosted path
dot.node('cloud_run', 'Cloud Run\nPhantom Server\n(Hono + WS)', fillcolor='#ce93d8', width='2.5')
dot.node('proxy_ws', 'Upstream WS\n(API key server-side)', fillcolor='#e1bee7', width='2.5')

# Gemini
dot.node('gemini', 'Gemini\nLive API', fillcolor='#bbdefb', penwidth='3', width='2')

# Landing
dot.node('landing', 'Landing Page\nphantom-server/\npublic/', fillcolor='#e3f2fd', shape='note')

# Edges
dot.edge('ext', 'choice', penwidth='2')
dot.edge('choice', 'byok_ws', label='BYOK\n(user API key)', penwidth='3', color='#2e7d32')
dot.edge('choice', 'cloud_run', label='Hosted\n(no key needed)', penwidth='3', color='#7b1fa2')
dot.edge('byok_ws', 'gemini', penwidth='3', color='#2e7d32')
dot.edge('cloud_run', 'proxy_ws', label='relay', penwidth='2')
dot.edge('proxy_ws', 'gemini', penwidth='3', color='#7b1fa2')
dot.edge('cloud_run', 'landing', label='GET /', style='dashed', penwidth='2')

dot.render('connection_modes', format='png', cleanup=True)
print("✅ connection_modes.png")
