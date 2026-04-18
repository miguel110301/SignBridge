import os
import re

file_path = "apps/web/src/modules/translator/TranslatorPage.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace zinc with slate
content = content.replace("zinc-", "slate-")

# Replace green/purple gradients with brand/accent 
content = content.replace("#34d399 0%, #10b981 100%", "#42c0c7 0%, #39c2d7 100%")
content = content.replace("#a78bfa 0%, #7c3aed 100%", "#719fc6 0%, #4c81ae 100%")

# Target the 'Voz a señas' exact gradient string
old_bg = "bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_rgba(9,9,11,0.96)_0%,_rgba(9,9,11,1)_100%)]"
new_bg = "bg-[radial-gradient(circle_at_top,_rgba(57,194,215,0.18),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(17,54,88,0.4),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.96)_0%,_rgba(2,6,23,1)_100%)]"
content = content.replace(old_bg, new_bg)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File updated. Replaced zinc, gradients.")
