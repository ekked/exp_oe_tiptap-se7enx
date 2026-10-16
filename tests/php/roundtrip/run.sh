#!/usr/bin/env bash
# Round trip test of the content mapping: fixtures (ezxml + ezoe HTML) -> Tiptap -> eZOEInputParser -> ezxml.
#
#   extension/exp_oe_tiptap/tests/php/roundtrip/run.sh <siteaccess> <sandbox> <work-dir>
#
# Run from the installation root.
#   <siteaccess>  the siteaccess whose settings (content.ini custom tags, classes, ...) the parser uses, e.g. the admin
#                 siteaccess of the site the fixtures come from. It must exist under settings/siteaccess/.
#   <sandbox>     a COPY of that site's database (the parser registers link URLs; the live database is refused):
#                   /abs/path/copy.db           an SQLite file
#                   mysql:<name>_sandbox        a MySQL/MariaDB database on the server of the siteaccess, with its
#                   mysql:<name>_rt             user and password; the name must end with _sandbox or _rt and differ
#                                               from the siteaccess's own database
#   <work-dir>    receives the HTML out of Tiptap, the ezxml of both paths and report.md / report.json.
# Exit code 0: Tiptap loses nothing ezoe alone keeps.
#
# The form of 0.1.x, run.sh <sandbox-copy.db> <work-dir>, still works and uses the siteaccess admin.
#
# License: GNU General Public License v2.0 (or any later version)
set -eu
usage() {
    echo "FAIL usage (from the installation root): $0 <siteaccess> </abs/path/copy.db | mysql:<name>_sandbox | mysql:<name>_rt> <work-dir>"
    exit 2
}
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
if [ ! -d "settings/siteaccess/$siteaccess" ]; then
    echo "FAIL no siteaccess '$siteaccess' (settings/siteaccess/$siteaccess is missing)"
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
mkdir -p "$3"
work=$(realpath "$3")
( cd extension/exp_oe_tiptap && node tests/js/schema/roundtrip.mjs "$work" )
# run.php checks the sandbox again (never the live database of the siteaccess) and that ezexec runs in $siteaccess
EXPOETIPTAP_SITEACCESS="$siteaccess" EXPOETIPTAP_SANDBOX="$sandbox" EXPOETIPTAP_TIPTAP_DIR="$work" \
    php bin/php/ezexec.php -s "$siteaccess" extension/exp_oe_tiptap/tests/php/roundtrip/run.php --allow-root-user
