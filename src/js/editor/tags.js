/**
 * The elements of the general attribute dialog at the cursor: the tags ezoe edits with tag_general.tpl and
 * tag_header.tpl (paragraph, header, ul, ol, li, strong, emphasize), whose classes and custom attributes come from
 * content.ini [<tag>] AvailableClasses[] / CustomAttributes[] (options.generalDefinitions).
 *
 * @license GPL-2.0-or-later
 */
import { getMarkRange } from '@tiptap/core';
import { xmlName } from '../ui/statusbar.js';

/** The ezxml tags of the general dialog, innermost first in the dialog's list of elements */
export const GENERAL_TAGS = [ 'strong', 'emphasize', 'paragraph', 'header', 'li', 'ul', 'ol' ];

/** English names of the ezxml tags, for the dialog's list of elements (translated with ctx.t) */
export const TAG_LABELS = {
    paragraph: 'Paragraph',
    header: 'Heading',
    ul: 'Bullet list',
    ol: 'Numbered list',
    li: 'List item',
    strong: 'Bold',
    emphasize: 'Italic',
    tr: 'Table row'
};

/**
 * The elements the general dialog can edit at the selection, innermost first: the marks (strong, emphasize) on the
 * selection, then the ancestors (and a selected node).
 *
 * @return {Array} [ { xml, mark, range } | { xml, node, pos } ]; range is the extent of the mark around the cursor
 */
export function generalTargets( editor ) {
    const { selection, doc } = editor.state;
    const result = [];
    const $from = selection.$from;
    const marks = selection.empty ? ( editor.state.storedMarks || $from.marks() ) : ( $from.marksAcross( selection.$to ) || [] );
    for ( const mark of marks ) {
        const xml = xmlName( mark );
        if ( GENERAL_TAGS.indexOf( xml ) !== -1 )
            result.push( { xml, mark, range: markRange( doc, selection, mark ) } );
    }
    if ( selection.node && GENERAL_TAGS.indexOf( xmlName( selection.node ) ) !== -1 )
        result.push( { xml: xmlName( selection.node ), node: selection.node, pos: selection.from } );
    for ( let d = $from.depth; d > 0; d-- ) {
        const node = $from.node( d ), xml = xmlName( node );
        if ( GENERAL_TAGS.indexOf( xml ) !== -1 )
            result.push( { xml, node, pos: $from.before( d ) } );
    }
    return result;
}

/** The whole extent of `mark` around the selection's start (Tiptap's getMarkRange), else the selection */
function markRange( doc, selection, mark ) {
    const range = getMarkRange( selection.$from, mark.type, mark.attrs ) ||
                  ( selection.from < doc.content.size ? getMarkRange( doc.resolve( selection.from + 1 ), mark.type, mark.attrs ) : null );
    return range || { from: selection.from, to: selection.to };
}

/**
 * The element the dialog opens on: the one of `target` (a status bar path item) when given, else the innermost one,
 * except a paragraph that is the only content of a list item: in ezoe's dialect that is the list item itself
 * (<li>text</li>), so the list item is chosen.
 */
export function preferredTarget( targets, target ) {
    if ( target ) {
        const i = targets.findIndex( ( c ) => ( target.mark && c.mark && c.mark.eq( target.mark ) ) ||
                                             ( target.node && c.node && c.pos === target.pos ) );
        if ( i !== -1 )
            return i;
    }
    const first = targets[0];
    if ( first && first.xml === 'paragraph' && targets[1] && targets[1].xml === 'li' && targets[1].node.childCount === 1 )
        return 1;
    return 0;
}
