#!/usr/bin/env sh
# SEC finaliser (audit Phase 2), Unresolved 1: which GitHub Pages sites share the hub's origin https://vantrix117.github.io?
# Every Pages site of a user account is served from <user>.github.io, so it shares localStorage (hub.device, hub.session)
# with the hub. Read-only: GitHub's API (public list, then the owner's list through the signed-in gh CLI; only repos that
# publish Pages are named) and one GET of the origin root. No request goes to the Worker.
#   sh "audits/tools/phase2/SEC/pages-origin-check.sh"   → audits/evidence/p2/SEC/pages-origin-check.txt
OUT="$(dirname "$0")/../../../evidence/p2/SEC/pages-origin-check.txt"
{
  echo "run: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "## public repos of vantrix117 (unauthenticated API): name has_pages"
  curl -s -m 20 "https://api.github.com/users/vantrix117/repos?per_page=100&type=owner" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('count',j.length);for(const r of j)console.log(r.name,'has_pages='+r.has_pages)})"
  echo "## all repos the account owns (gh api user/repos, affiliation=owner): count, then those with Pages"
  echo "count $(gh api 'user/repos?per_page=100&affiliation=owner' --paginate -q '.[].name' | wc -l)"
  gh api 'user/repos?per_page=100&affiliation=owner' --paginate -q '.[] | select(.has_pages==true) | "\(.name) private=\(.private) has_pages=\(.has_pages)"'
  echo "## user site at the origin root"
  curl -s -o /dev/null -m 20 -w "GET https://vantrix117.github.io/ -> %{http_code}\n" https://vantrix117.github.io/
} > "$OUT" 2>&1
cat "$OUT"
