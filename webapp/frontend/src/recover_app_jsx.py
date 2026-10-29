import json

transcript_path = '/home/ubuntu/.gemini/antigravity-cli/brain/d91418a7-af2d-4aa9-b7a9-9aab8bf4195d/.system_generated/logs/transcript_full.jsonl'
file_path = '/home/ubuntu/gamestore/webapp/frontend/src/App.jsx'

with open(file_path, 'r') as f:
    content = f.read()

applied_count = 0
failed_count = 0
with open(transcript_path, 'r') as f:
    for line in f:
        try:
            step = json.loads(line)
        except:
            continue
            
        step_index = step.get('step_index', 0)
        if step_index > 7808:
            break
            
        if step.get('source') == 'MODEL' and step.get('type') == 'PLANNER_RESPONSE':
            tool_calls = step.get('tool_calls', [])
            for tc in tool_calls:
                if tc.get('name') == 'replace_file_content':
                    args = tc.get('args', {})
                    if args.get('TargetFile', '') == '/home/ubuntu/gamestore/webapp/frontend/src/App.jsx':
                        target = args.get('TargetContent')
                        replacement = args.get('ReplacementContent')
                        
                        if target is not None and replacement is not None:
                            if target in content:
                                content = content.replace(target, replacement, 1)
                                applied_count += 1
                            else:
                                failed_count += 1
                                print(f"Warning: target not found in step {step_index}")

print(f"Applied {applied_count} replacements. Failed {failed_count}.")
with open(file_path + '.recovered', 'w') as f:
    f.write(content)
