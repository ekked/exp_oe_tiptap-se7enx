#!/usr/bin/env bash
# Round trip test of the content mapping: fixtures (ezxml + ezoe HTML) -> Tiptap -> eZOEInputParser -> ezxml.
#
#   extension/exp_oe_tiptap/tests/php/roundtrip/run.sh [--fixtures=<dir>] <siteaccess> <sandbox> <work-dir>
#
# Run from the installation root.
#   --fixtures=<dir> a directory of fixture pairs (<name>.xml, <name>.html) to use instead of tests/fixtures/, e.g. the
#                 output of bin/php/export_roundtrip_fixtures.php; EXPOETIPTAP_FIXTURES_DIR=<dir> does the same.
#   <siteaccess>  the siteaccess whose settings (content.ini custom tags, classes, ...) the parser uses, e.g. the admin
#                 siteaccess of the site the fixtures come from. Its settings must exist under settings/siteaccess/ or
#                 extension/*/settings/siteaccess/; run.php then checks that ezexec really runs in it.
#   <sandbox>     a COPY of that site's database (the parser registers link URLs; the live database is refused):
#                   /abs/path/copy.db           an SQLite file
#                   mysql:<name>_sandbox        a MySQL/MariaDB database on the server of the siteaccess, with its
#                   mysql:<name>_rt             user and password; the name must end with _sandbox or _rt and differ
#                                               from the siteaccess's own database
#                 run.php also refuses a MySQL name that is the Database of any siteaccess's or the override's
#                 site.ini, and a MySQL database without the marker table exp_oe_tiptap_sandbox. Create it in the
#                 copy, never in the live database:
#                   mysqldump site | mysql site_rt
#                   mysql site_rt -e 'CREATE TABLE exp_oe_tiptap_sandbox ( id INT )'
#   <work-dir>    receives the HTML out of Tiptap, the ezxml of both paths and report.md / report.json.
# Exit code 0: Tiptap loses nothing ezoe alone keeps.
#
# The form of 0.1.x, run.sh <sandbox-copy.db> <work-dir>, is kept: it uses the siteaccess named admin, and fails like
# any other unknown siteaccess where the installation has none of that name.
#
# License: GNU General Public License v2.0 (or any later version)
set -eu
usage() {
    echo "FAIL usage (from the installation root): $0 [--fixtures=<dir>] <siteaccess> </abs/path/copy.db | mysql:<name>_sandbox | mysql:<name>_rt> <work-dir>"
    exit 2
}
fixtures=${EXPOETIPTAP_FIXTURES_DIR:-}
case "${1:-}" in
    --fixtures=*) fixtures=${1#--fixtures=}; shift ;;
esac
if [ $# -eq 2 ]; then
    echo "NOTE run.sh <sandbox> <work-dir> is the form of 0.1.x: using the siteaccess admin"
    set -- admin "$1" "$2"
fi
[ $# -eq 3 ] || usage
[ -f extension/exp_oe_tiptap/package.json ] || usage
siteaccess=$1
sandbox=$2
case "$siteaccess" in
    ''|*[!A-Za-z0-9_-]*) echo "FAIL '$siteaccess' is not a siteaccess name"; exit 2 ;;
esac
found=
for dir in "settings/siteaccess/$siteaccess" extension/*/settings/siteaccess/"$siteaccess"; do
    [ -d "$dir" ] && found=1
done
if [ -z "$found" ]; then
    echo "FAIL no siteaccess '$siteaccess' (no settings/siteaccess/$siteaccess, no extension/*/settings/siteaccess/$siteaccess)"
    exit 2
fi
case "$sandbox" in
    mysql:*)
        name=${sandbox#mysql:}
        case "$name" in
            *[!A-Za-z0-9_]*|'') echo "FAIL '$name' is not a database name"; exit 2 ;;
            *_sandbox|*_rt) ;;
            *) echo "FAIL refusing the database '$name': the name of a sandbox copy must end with _sandbox or _rt"; exit 2 ;;
        esac
        ;;
    *)
        [ -f "$sandbox" ] || usage
        sandbox=$(realpath "$sandbox")
        ;;
esac
if [ -n "$fixtures" ]; then
    if [ ! -d "$fixtures" ]; then
        echo "FAIL no fixtures directory '$fixtures'"
        exit 2
    fi
    fixtures=$(realpath "$fixtures")
fi
mkdir -p "$3"
work=$(realpath "$3")
if [ -n "$fixtures" ] && [ "$work" = "$fixtures" ]; then
    echo "FAIL the work directory must not be the fixtures directory (step 1 writes <name>.html there)"
    exit 2
fi
export EXPOETIPTAP_FIXTURES_DIR="$fixtures"
( cd extension/exp_oe_tiptap && node tests/js/schema/roundtrip.mjs "$work" )
# run.php checks the sandbox again (never the live database of the siteaccess) and that ezexec runs in $siteaccess
EXPOETIPTAP_SITEACCESS="$siteaccess" EXPOETIPTAP_SANDBOX="$sandbox" EXPOETIPTAP_TIPTAP_DIR="$work" \
    php bin/php/ezexec.php -s "$siteaccess" extension/exp_oe_tiptap/tests/php/roundtrip/run.php --allow-root-user
