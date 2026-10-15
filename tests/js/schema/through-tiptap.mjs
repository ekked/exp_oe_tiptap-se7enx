/**
 * The editor HTML of stdin through Tiptap as the browser does it: parsed (fromEditorHTML) and posted again
 * (toEditorHTML), written to stdout. Used by tests/php/EmptyParagraphRoundtripTest.php, which feeds the result to
 * eZOEInputParser and the stored ezxml back to eZOEXMLInput::inputXML() for the next pass.
 *
 *   node tests/js/schema/through-tiptap.mjs < editor.html
 *
 * happy-dom differs from the HTML parser of browsers in one point that matters here: for <p><table>...</table></p>
 * (eZOEXMLInput's form of a paragraph holding a table) both close the <p> before the table, but a browser makes an
 * empty <p></p> of the stray </p> after it, and happy-dom drops it. That paragraph is added here, so the input
 * Tiptap gets is the browser's.
 *
 * @license GPL-2.0-or-later
 */
import { Window } from 'happy-dom';
import { fromEditorHTML, toEditorHTML } from '../../../src/js/schema/index.js';

let html = '';
process.stdin.setEncoding( 'utf8' );
for await ( const chunk of process.stdin )
    html += chunk;
const window = new Window();
const options = { document: window.document };
const asBrowser = html.replace( /<\/table><\/p>/g, '</table></p><p></p>' );
process.stdout.write( toEditorHTML( fromEditorHTML( asBrowser, options ), options ) );
await window.happyDOM.close();
