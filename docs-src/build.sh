#!/bin/bash
# GapFinder documentation build.
#   bash build.sh diagrams   -> re-render diagram PNGs
#   bash build.sh pdfs       -> re-render the six PDFs
#   bash build.sh qa <doc.html> <pageNo> <out.png>
set -u
S="C:/Users/bhanu/Downloads/gapfinder/docs-src"
OUT="C:/Users/bhanu/Downloads/gapfinder/GapFinder_Final_Documentation"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"

render_diagram() { # <src.html> <dest.png> <width>
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars --allow-file-access-from-files \
    --screenshot="$2" --window-size="$3",4000 --force-device-scale-factor=2 \
    --virtual-time-budget=15000 "file:///$S/$1" >/dev/null 2>&1
}

render_pdf() { # <src.html> <dest.pdf>
  "$CHROME" --headless --disable-gpu --no-sandbox --no-pdf-header-footer --allow-file-access-from-files \
    --print-to-pdf="$2" --virtual-time-budget=25000 "file:///$S/$1" >/dev/null 2>&1
}

case "${1:-}" in
  diagrams)
    render_diagram d01_arch.html "$OUT/diagrams/01_system_architecture.png" 2400
    render_diagram d02_loop.html "$OUT/diagrams/02_core_learning_loop.png" 2400
    render_diagram d03_ai.html   "$OUT/diagrams/03_ai_pipeline.png"        2400
    render_diagram d04_eco.html  "$OUT/diagrams/04_product_ecosystem.png"  2400
    render_diagram d05_data.html "$OUT/diagrams/05_data_flow.png"          2400
    node "$S/crop.mjs" "$OUT/diagrams"
    ;;
  pdfs)
    render_pdf 01_overview.html     "$OUT/01_GapFinder_Overview.pdf"
    render_pdf 02_product.html      "$OUT/02_GapFinder_Product.pdf"
    render_pdf 03_ai.html           "$OUT/03_GapFinder_AI.pdf"
    render_pdf 04_architecture.html "$OUT/04_GapFinder_Architecture.pdf"
    render_pdf 05_evidence.html     "$OUT/05_GapFinder_Evidence.pdf"
    render_pdf 06_judge_guide.html  "$OUT/06_GapFinder_Judge_Guide.pdf"
    ;;
  qa) # qa <doc.html> <pageNo> <out.png>
    TMP="$S/.qa_$3.html"
    cp "$S/$2" "$TMP"
    printf '<style>body>div.page{display:none !important}body>div.page:nth-of-type(%s){display:flex !important}</style>' "$3" >> "$TMP"
    "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars --allow-file-access-from-files \
      --user-data-dir="$S/.chromeqa" --screenshot="$4" --window-size=1123,793 --force-device-scale-factor=1.7 \
      --virtual-time-budget=12000 "file:///$TMP" >/dev/null 2>&1
    rm -f "$TMP"
    ;;
  *) echo "usage: build.sh diagrams|pdfs|qa"; exit 1;;
esac
echo "done: ${1:-}"
