import re
import subprocess

file_path = '/home/ubuntu/gamestore/webapp/frontend/src/App.jsx'

# 1. Start from clean HEAD
subprocess.run(['git', 'checkout', '--', file_path])

with open(file_path, 'r') as f:
    content = f.read()

# 2. Insert AdminB2BManagementPortal before PanelScreen so scratch_b2b.py can find it
admin_portal_code = """
function AdminB2BManagementPortal({ me, onSwitchToReseller }) {
  // Placeholder so the regex finds it
}

function PanelScreen"""

content = content.replace("function PanelScreen", admin_portal_code)

with open(file_path, 'w') as f:
    f.write(content)
