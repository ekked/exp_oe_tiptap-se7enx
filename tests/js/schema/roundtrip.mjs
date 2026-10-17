/**
 * Step 1 of the round trip test: every fixture's ezoe editor HTML -> Tiptap document -> ezoe editor HTML.
 * Writes <outdir>/<name>.html for tests/php/roundtrip/run.php, which feeds it to eZOEInputParser.
 *
 *   node tests/js/schema/roundtrip.mjs <outdir>
 *   EXPOETIPTAP_FIXTURES_DIR=/abs/path/fixtures node tests/js/schema/roundtrip.mjs <outdir>
 *
 * The fixtures are read from tests/fixtures/ unless EXPOETIPTAP_FIXTURES_DIR names another directory of pairs
 * (bin/php/export_roundtrip_fixtures.php writes them from a site's own content).
 *
 * @license GPL-2.0-or-later
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { fromEditorHTML, toEditorHTML, cleanupForEzoe } from '../../../src/js/schema/index.js';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '../../..' );
const fixtures = process.env.EXPOETIPTAP_FIXTURES_DIR ? resolve( process.env.EXPOETIPTAP_FIXTURES_DIR ) : resolve( root, 'tests/fixtures' );
if ( !existsSync( fixtures ) ) {
    console.log( 'FAIL no fixtures directory ' + fixtures );
    process.exit( 1 );
}
const outdir = process.argv[ 2 ];
if ( !outdir ) {
    console.log( 'FAIL usage: node tests/js/schema/roundtrip.mjs <outdir>' );
    process.exit( 1 );
}
if ( resolve( outdir ) === fixtures ) {
    console.log( 'FAIL the output directory must not be the fixtures directory' );
    process.exit( 1 );
}
mkdirSync( outdir, { recursive: true } );

// happy-dom keeps what a window parsed alive until the window closes: a fresh window every WINDOW_FIXTURES fixtures
// keeps a run over thousands of a site's own fields (EXPOETIPTAP_FIXTURES_DIR) within the heap
const WINDOW_FIXTURES = 200;
let window = new Window();
let options = { document: window.document };

/**
 * The baseline: what ezoe's TinyMCE would post for the same content without Tiptap, approximated as the HTML after
 * the browser parsed it, TinyMCE's bogus elements removed (their children kept) and the ezoe save clean-ups made.
 */
function ezoeBaseline( html ) {
    const container = window.document.createElement( 'div' );
    container.innerHTML = html;
    container.querySelectorAll( '[data-mce-bogus]' ).forEach( node => {
        while ( node.firstChild )
            node.parentNode.insertBefore( node.firstChild, node );
        node.parentNode.removeChild( node );
    } );
    container.querySelectorAll( '[data-mce-href]' ).forEach( node => node.removeAttribute( 'data-mce-href' ) );
    cleanupForEzoe( container );
    return container.innerHTML;
}
let count = 0;
let unstable = 0;
for ( const file of readdirSync( fixtures ).filter( name => name.endsWith( '.html' ) ).sort() ) {
    if ( count && count % WINDOW_FIXTURES === 0 ) {
        await window.happyDOM.close();
        window = new Window();
        options = { document: window.document };
    }
    const html = readFileSync( resolve( fixtures, file ), 'utf8' );
    const out = toEditorHTML( fromEditorHTML( html, options ), options );
    const again = toEditorHTML( fromEditorHTML( out, options ), options );
    if ( again !== out ) {
        unstable++;
        console.log( 'UNSTABLE ' + file );
    }
    writeFileSync( resolve( outdir, file ), out );
    writeFileSync( resolve( outdir, file.replace( /\.html$/, '.ezoe.html' ) ), ezoeBaseline( html ) );
    count++;
}
await window.happyDOM.close();
console.log( ( unstable ? 'FAIL' : 'PASS' ) + ` ${count} fixtures of ${fixtures} through Tiptap, ${unstable} not stable on a second pass, written to ${outdir}` );
process.exit( unstable ? 1 : 0 );
