import json
import re

transcript_path = '/home/ubuntu/.gemini/antigravity-cli/brain/d91418a7-af2d-4aa9-b7a9-9aab8bf4195d/.system_generated/logs/transcript_full.jsonl'
out_path = '/home/ubuntu/gamestore/webapp/frontend/src/app_history.txt'

with open(out_path, 'w') as out, open(transcript_path, 'r') as f:
    for line in f:
        try:
            step = json.loads(line)
        except:
            continue
            
        if step.get('source') == 'MODEL' and step.get('type') == 'PLANNER_RESPONSE':
            tool_calls = step.get('tool_calls', [])
            for tc in tool_calls:
                name = tc.get('name')
                args = tc.get('args', {})
                if name == 'replace_file_content' and 'App.jsx' in args.get('TargetFile', ''):
                    out.write(f"--- STEP {step['step_index']} replace_file_content ---\n")
                elif name == 'write_to_file' and 'App.jsx' in args.get('TargetFile', ''):
                    out.write(f"--- STEP {step['step_index']} write_to_file ---\n")
                elif name == 'run_command':
                    cmd = args.get('CommandLine', '')
                    if 'App.jsx' in cmd or 'scratch_' in cmd:
                        out.write(f"--- STEP {step['step_index']} run_command ---\n{cmd}\n\n")
