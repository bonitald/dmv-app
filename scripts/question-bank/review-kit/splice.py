"""Replace one `## <chunkId>` section of concept-list.md with an agent's conceptlist block."""
import re
import sys

list_path, chunk, block_path = sys.argv[1:4]
text = open(list_path, encoding="utf-8").read()
block = open(block_path, encoding="utf-8").read().strip() + "\n"
if not block.startswith(f"## {chunk}\n"):
    sys.exit(f"block for {chunk} does not start with its heading")

pattern = re.compile(rf"^## {re.escape(chunk)}\n.*?(?=^## |\Z)", re.S | re.M)
old = pattern.search(text)
if not old:
    sys.exit(f"section {chunk} not found")

old_concepts = re.findall(r"^- ([\w-]+) \(", old.group(0), re.M)
new_concepts = re.findall(r"^- ([\w-]+) \(", block, re.M)
if sorted(old_concepts) != sorted(new_concepts):
    sys.exit(f"concept mismatch for {chunk}: {set(old_concepts) ^ set(new_concepts)}")
if "pending_review" in block:
    sys.exit(f"{chunk} block still has pending_review")

tail = "\n" if old.end() < len(text) else ""
text = text[: old.start()] + block + tail + text[old.end():]
open(list_path, "w", encoding="utf-8", newline="\r\n").write(text)
print(f"spliced {chunk}: {len(new_concepts)} concepts")
