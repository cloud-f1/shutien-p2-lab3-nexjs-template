#!/bin/bash
# Build talk.html — single-file delivery version
# Inlines all external markdown into <textarea data-template> blocks
# so reveal.js can parse them without fetch() — works via file://
#
# Usage: cd docs/presentations/ai-coding-template-talk && bash build.sh
# Output: talk.html (portable, no server needed)

set -e
cd "$(dirname "$0")"

INPUT="index.html"
OUTPUT="talk.html"

echo "Building $OUTPUT from $INPUT..."

# Read index.html line by line
# When we hit a data-markdown="slides/XX.md" line, inline the content
python3 -c "
import re, sys

with open('$INPUT', 'r') as f:
    html = f.read()

# Pattern: <section data-markdown=\"slides/XX.md\" ...separator attrs...></section>
pattern = r'<section\s+data-markdown=\"(slides/[^\"]+)\"\s*\n\s*data-separator=\"([^\"]*)\"\s*\n\s*data-separator-notes=\"([^\"]*)\"></section>'

def replace_md(match):
    md_path = match.group(1)
    separator = match.group(2)
    notes_sep = match.group(3)
    try:
        with open(md_path, 'r') as mf:
            content = mf.read()
        # Wrap in textarea for inline markdown parsing
        return (
            f'<section data-markdown '
            f'data-separator=\"{separator}\" '
            f'data-separator-notes=\"{notes_sep}\">'
            f'<textarea data-template>\n{content}\n</textarea>'
            f'</section>'
        )
    except FileNotFoundError:
        print(f'  WARNING: {md_path} not found, keeping external ref', file=sys.stderr)
        return match.group(0)

result = re.sub(pattern, replace_md, html)

# Count replacements
orig_count = len(re.findall(pattern, html))
print(f'  Inlined {orig_count} markdown files')

with open('$OUTPUT', 'w') as f:
    f.write(result)

print(f'  Written to $OUTPUT')
"

# Show file size comparison
echo ""
echo "Size comparison:"
ls -lh "$INPUT" "$OUTPUT" | awk '{print "  " $5 "  " $NF}'
echo ""
echo "Done. Open $OUTPUT via file:// or double-click."
