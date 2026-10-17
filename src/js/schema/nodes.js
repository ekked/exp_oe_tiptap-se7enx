/**
 * Nodes of the ezoe editor HTML dialect (what eZOEXMLInput::inputXML() writes and eZOEInputParser reads).
 * See doc/content-mapping.md for the full table ezxml <-> ezoe HTML <-> Tiptap.
 *
 * @license GPL-2.0-or-later
 */
import { Node } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { attributeSet, cleanClass, COMMON } from './attributes.js';

const BLOCK_ATTRIBUTES = [ 'align' ].concat( COMMON );

export const Document = Node.create( {
    name: 'doc',
    topNode: true,
    content: 'block+'
} );

export const Text = Node.create( {
    name: 'text',
    group: 'inline'
} );

/** ezxml <paragraph> = <p align class customattributes style>. */
export const Paragraph = Node.create( {
    name: 'paragraph',
    priority: 1000,
    group: 'block',
    content: 'inline*',
    addAttributes() {
        return attributeSet( BLOCK_ATTRIBUTES );
    },
    parseHTML() {
        return [ { tag: 'p' } ];
    },
    renderHTML( { HTMLAttributes } ) {
        return [ 'p', HTMLAttributes, 0 ];
    },
    addCommands() {
        return {
            setParagraph: () => ( { commands } ) => commands.setNode( this.name )
        };
    },
    addKeyboardShortcuts() {
        return { 'Mod-Alt-0': () => this.editor.commands.setParagraph() };
    }
} );

/**
 * ezxml <header> = <hN>, N is the section depth. An anchor_name on the header is written as an anchor at the start:
 * <h2><a name="x" class="mceItemAnchor"></a>Text</h2>.
 */
export const Heading = Node.create( {
    name: 'heading',
    group: 'block',
    content: 'inline*',
    defining: true,
    addOptions() {
        return { levels: [ 1, 2, 3, 4, 5, 6 ] };
    },
    addAttributes() {
        return Object.assign( { level: { default: 1, rendered: false } }, attributeSet( BLOCK_ATTRIBUTES ) );
    },
    parseHTML() {
        return this.options.levels.map( level => ( { tag: 'h' + level, attrs: { level } } ) );
    },
    renderHTML( { node, HTMLAttributes } ) {
        const level = this.options.levels.includes( node.attrs.level ) ? node.attrs.level : this.options.levels[ 0 ];
        return [ 'h' + level, HTMLAttributes, 0 ];
    },
    addCommands() {
        return {
            setHeading: attributes => ( { commands } ) => commands.setNode( this.name, attributes ),
            toggleHeading: attributes => ( { commands } ) => commands.toggleNode( this.name, 'paragraph', attributes )
        };
    },
    addKeyboardShortcuts() {
        const shortcuts = {};
        this.options.levels.forEach( level => {
            shortcuts[ 'Mod-Alt-' + level ] = () => this.editor.commands.toggleHeading( { level } );
        } );
        return shortcuts;
    }
} );

/** ezxml <line> = text followed by <br>. TinyMCE's bogus <br data-mce-bogus="1"> is ignored. */
export const HardBreak = Node.create( {
    name: 'hardBreak',
    group: 'inline',
    inline: true,
    selectable: false,
    linebreakReplacement: true,
    parseHTML() {
        return [ { tag: 'br[data-mce-bogus]', ignore: true, priority: 60 }, { tag: 'br' } ];
    },
    renderHTML() {
        return [ 'br' ];
    },
    renderText() {
        return '\n';
    },
    addCommands() {
        return {
            setHardBreak: () => ( { commands } ) => commands.insertContent( { type: this.name } )
        };
    },
    addKeyboardShortcuts() {
        return { 'Shift-Enter': () => this.editor.commands.setHardBreak(), 'Mod-Enter': () => this.editor.commands.setHardBreak() };
    }
} );

/**
 * A <br> between two blocks, outside any paragraph. eZOEXMLInput writes it after block embeds whose paragraph goes
 * on (ezxml <paragraph><line><embed/>...</line><table/>...</paragraph>), and eZOEInputParser reads it back as that
 * <line>. Left to the hard break, the parse put it into an empty paragraph of its own, and the <line> was lost.
 * Only matched where a block stands (the document, a cell, a list item, a custom tag); a <br> in a paragraph stays
 * a hard break.
 */
export const BlockBreak = Node.create( {
    name: 'expBlockBreak',
    group: 'block',
    atom: true,
    selectable: true,
    parseHTML() {
        return [ { tag: 'br:not([data-mce-bogus])', priority: 61, context: 'doc/|tableCell/|tableHeader/|listItem/|ezCustomBlock/' } ];
    },
    renderHTML() {
        return [ 'br' ];
    }
} );

function list( name, tag, command, shortcut ) {
    return Node.create( {
        name,
        group: 'block',
        content: 'listItem+',
        addAttributes() {
            return attributeSet( COMMON );
        },
        parseHTML() {
            return [ { tag } ];
        },
        renderHTML( { HTMLAttributes } ) {
            return [ tag, HTMLAttributes, 0 ];
        },
        addCommands() {
            return {
                [ command ]: () => ( { commands } ) => commands.toggleList( this.name, 'listItem' )
            };
        },
        addKeyboardShortcuts() {
            return { [ shortcut ]: () => this.editor.commands[ command ]() };
        }
    } );
}

/** ezxml <ul> / <ol> = <ul> / <ol> with class, customattributes, style. */
export const BulletList = list( 'bulletList', 'ul', 'toggleBulletList', 'Mod-Shift-8' );
export const OrderedList = list( 'orderedList', 'ol', 'toggleOrderedList', 'Mod-Shift-7' );

/**
 * ezxml <li>. ezoe writes the content of a list item with a single paragraph without the <p> (<li>text</li>), and
 * with <p> when there are several; the parser accepts both. The content is any block, so a list item that starts
 * with a nested list does not get an empty paragraph.
 */
export const ListItem = Node.create( {
    name: 'listItem',
    content: 'block+',
    defining: true,
    addAttributes() {
        return attributeSet( COMMON );
    },
    parseHTML() {
        return [ { tag: 'li' } ];
    },
    renderHTML( { HTMLAttributes } ) {
        return [ 'li', HTMLAttributes, 0 ];
    },
    addKeyboardShortcuts() {
        return {
            Enter: () => this.editor.commands.splitListItem( this.name ),
            Tab: () => this.editor.commands.sinkListItem( this.name ),
            'Shift-Tab': () => this.editor.commands.liftListItem( this.name )
        };
    }
} );

/**
 * ezxml <literal> = <pre class customattributes style>, line breaks of the text as <br>. The text is kept as it
 * is (no marks, no collapsing of white space).
 */
export const Literal = Node.create( {
    name: 'literal',
    group: 'block',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    addAttributes() {
        return attributeSet( COMMON );
    },
    parseHTML() {
        return [ {
            tag: 'pre',
            preserveWhitespace: 'full',
            getContent: ( dom, schema ) => {
                const text = literalText( dom );
                return text ? Fragment.from( schema.text( text ) ) : Fragment.empty;
            }
        } ];
    },
    renderHTML( { HTMLAttributes } ) {
        return [ 'pre', HTMLAttributes, 0 ];
    },
    addCommands() {
        return {
            toggleLiteral: () => ( { commands } ) => commands.toggleNode( this.name, 'paragraph' )
        };
    },
    addKeyboardShortcuts() {
        return {
            Enter: () => this.editor.isActive( this.name ) && this.editor.commands.insertContent( '\n' ),
            'Shift-Enter': () => this.editor.isActive( this.name ) && this.editor.commands.insertContent( '\n' )
        };
    }
} );

/** The text of a <pre>: <br> and paragraph ends are line breaks, as eZOEInputParser::parsingHandlerLiteral() reads them. */
export function literalText( dom ) {
    let text = '';
    const walk = node => {
        node.childNodes.forEach( child => {
            if ( child.nodeType === 3 )
                text += child.nodeValue;
            else if ( child.nodeType === 1 ) {
                const name = child.nodeName.toLowerCase();
                if ( name === 'br' )
                    text += '\n';
                else if ( name === 'p' ) {
                    if ( text !== '' )
                        text += '\n\n';
                    walk( child );
                }
                else
                    walk( child );
            }
        } );
    };
    walk( dom );
    return text;
}

/** ezxml <anchor name> = <a name="x" class="mceItemAnchor"></a>, an inline atom. */
export const Anchor = Node.create( {
    name: 'ezAnchor',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
        // an id is TinyMCE 8's way of writing the name (rule below), never stored
        return attributeSet( [ 'name', 'customattributes', 'class', 'style' ], [ 'id' ] );
    },
    parseHTML() {
        return [
            { tag: 'a[name]:not([href])', priority: 60 },
            // TinyMCE 8 writes anchors as <a id="name"></a>, the ezlink plugin of ezoe saves them with name
            { tag: 'a[id]:not([href])', priority: 59, getAttrs: node => ( { name: node.getAttribute( 'id' ), class: 'mceItemAnchor' } ) },
            { tag: 'a.mceItemAnchor', priority: 58 }
        ];
    },
    renderHTML( { HTMLAttributes } ) {
        return [ 'a', HTMLAttributes ];
    },
    addCommands() {
        return {
            insertAnchor: ( name, customattributes = null ) => ( { commands } ) =>
                commands.insertContent( { type: this.name, attrs: { name, class: 'mceItemAnchor', customattributes } } )
        };
    }
} );

const EMBED_ID = /^eZ(Object|Node)_\d+$/;
const EMBED_ATTRIBUTES = [ 'id', 'title', 'alt', 'view', 'inline', 'align', 'html_id', 'show_path' ].concat( COMMON );

/**
 * The preview ezoe renders inside a <div>/<span> embed (the embed template of the object). It is shown in the
 * editor, never saved: on save it becomes the text "ezembed", as ezoe's TinyMCE plugin does.
 */
function previewAttribute() {
    return {
        default: null,
        rendered: false,
        parseHTML: element => {
            const html = element.innerHTML;
            return html && html !== 'ezembed' ? html : null;
        }
    };
}

function renderEmbedElement( tag, node, HTMLAttributes ) {
    const doc = typeof document !== 'undefined' ? document : null;
    if ( !doc || !node.attrs.preview )
        return [ tag, HTMLAttributes, 'ezembed' ];
    const element = doc.createElement( tag );
    Object.keys( HTMLAttributes ).forEach( name => {
        if ( HTMLAttributes[ name ] != null )
            element.setAttribute( name, HTMLAttributes[ name ] );
    } );
    element.innerHTML = node.attrs.preview;
    return element;
}

function embedRule( tag, priority = 100 ) {
    return {
        tag,
        priority,
        getAttrs: element => ( EMBED_ID.test( element.getAttribute( 'id' ) || '' ) ? null : false )
    };
}

function insertEmbedCommand( name ) {
    return attributes => ( { commands } ) => commands.insertContent( { type: name, attrs: attributes } );
}

/**
 * ezxml <embed> of an object that is not an image (CompatibilityMode disabled):
 * <div id="eZObject_ID|eZNode_ID" title alt="size" view inline="false" align html_id show_path
 *      class="ezoeItemNonEditable CLASS ezoeItemContentTypeGROUP" customattributes style>preview</div>
 */
export const EmbedBlock = Node.create( {
    name: 'ezEmbed',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
        return Object.assign( attributeSet( EMBED_ATTRIBUTES ), { preview: previewAttribute() } );
    },
    parseHTML() {
        return [ embedRule( 'div' ) ];
    },
    renderHTML( { node, HTMLAttributes } ) {
        return renderEmbedElement( 'div', node, HTMLAttributes );
    },
    addCommands() {
        return { insertEmbed: insertEmbedCommand( this.name ) };
    }
} );

/** ezxml <embed-inline> of an object that is not an image: <span id="eZObject_ID" ... inline="true">preview</span>. */
export const EmbedInline = Node.create( {
    name: 'ezEmbedInline',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
        return Object.assign( attributeSet( EMBED_ATTRIBUTES ), { preview: previewAttribute() } );
    },
    parseHTML() {
        return [ embedRule( 'span' ) ];
    },
    renderHTML( { node, HTMLAttributes } ) {
        return renderEmbedElement( 'span', node, HTMLAttributes );
    },
    addCommands() {
        return { insertEmbedInline: insertEmbedCommand( this.name ) };
    }
} );

/**
 * ezxml <embed> / <embed-inline> of an image object (content.ini [RelationGroupSettings] ImagesClassList), and of
 * any object in CompatibilityMode: an inline <img id="eZObject_ID" title src width height alt="size" view
 * inline="true|false" align class customattributes style>. ezoe keeps it inside the paragraph.
 */
export const EmbedImage = Node.create( {
    name: 'ezEmbedImage',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
        return attributeSet( EMBED_ATTRIBUTES.concat( [ 'src', 'width', 'height' ] ) );
    },
    parseHTML() {
        return [ embedRule( 'img' ) ];
    },
    renderHTML( { HTMLAttributes } ) {
        return [ 'img', HTMLAttributes ];
    },
    addCommands() {
        return { insertEmbedImage: insertEmbedCommand( this.name ) };
    }
} );

/**
 * ezxml <custom name> of a block custom tag: <div class="ezoeItemCustomTag NAME" type="custom" customattributes
 * style align>blocks</div>. An empty one holds <p>NAME</p>, which the parser removes again.
 */
export const CustomBlock = Node.create( {
    name: 'ezCustomBlock',
    group: 'block',
    content: 'block+',
    defining: true,
    addAttributes() {
        return attributeSet( [ 'class', 'type', 'customattributes', 'style', 'align' ] );
    },
    parseHTML() {
        return [ { tag: 'div[type="custom"]', priority: 90 } ];
    },
    renderHTML( { HTMLAttributes } ) {
        return [ 'div', HTMLAttributes, 0 ];
    },
    addCommands() {
        return {
            /** Wraps the selected blocks in the block custom tag `name`. */
            setCustomBlock: ( name, customattributes = null ) => ( { commands } ) =>
                commands.wrapIn( this.name, { class: 'ezoeItemCustomTag ' + name, type: 'custom', customattributes } ),
            /** Inserts an empty block custom tag `name` (holding <p>name</p>, as ezoe does). */
            insertCustomBlock: ( name, customattributes = null ) => ( { commands } ) => commands.insertContent( {
                type: this.name,
                attrs: { class: 'ezoeItemCustomTag ' + name, type: 'custom', customattributes },
                content: [ { type: 'paragraph', content: [ { type: 'text', text: name } ] } ]
            } ),
            unsetCustomBlock: () => ( { commands } ) => commands.lift( this.name )
        };
    }
} );

/**
 * ezxml <custom name> of an inline custom tag shown as an image (IsInline[name]=image):
 * <img src="icon" class="ezoeItemCustomTag NAME" type="custom" customattributes width height style align>.
 */
export const CustomImage = Node.create( {
    name: 'ezCustomImage',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
        return attributeSet( [ 'src', 'class', 'type', 'customattributes', 'width', 'height', 'style', 'align' ] );
    },
    parseHTML() {
        return [ { tag: 'img[type="custom"]', priority: 90 } ];
    },
    renderHTML( { HTMLAttributes } ) {
        return [ 'img', HTMLAttributes ];
    },
    addCommands() {
        return { insertCustomImage: insertEmbedCommand( this.name ) };
    }
} );

/** The inline custom tags kept as one piece when no list is given (exp_oe_tiptap.ini [EditorSettings] AtomicInlineCustomTags[]) */
export const DEFAULT_ATOMIC_INLINE_CUSTOM_TAGS = [ 'math_latex', 'math_mathml' ];

/** The inline custom tags whose text is TeX source when no list is given (content.ini [CustomTagSettings] TeXSource[]) */
export const DEFAULT_TEX_SOURCE_CUSTOM_TAGS = [ 'math_latex' ];

/** The index of the first % of a line that is not escaped (\% is a percent sign, \\% a line break and a comment), or -1 */
function commentStart( line ) {
    for ( let i = 0; i < line.length; i++ ) {
        if ( line[ i ] !== '%' )
            continue;
        let backslashes = 0;
        for ( let j = i - 1; j >= 0 && line[ j ] === '\\'; j-- )
            backslashes++;
        if ( backslashes % 2 === 0 )
            return i;
    }
    return -1;
}

/**
 * The text of an atomic inline custom tag as it is stored. ezoe's parser removes every line break of a text when it
 * stores it (eZXMLInputParser, ParseLineBreaks=false): "\cdot<line break>x" became "\cdotx". So a line break and
 * the white space around it become one space, as TeX reads it (and as eZOEXMLInput::inputXML() writes a stored line
 * break since #1117). In TeX source (tex) a comment first goes with the rest of its line, the line break and the
 * indentation of the next line, as eZOEXMLInput::texWithoutLineComments() removes it; a space separates a control
 * word before the comment from a letter after it ("\cdot%c<line break>x" is "\cdot x", not "\cdotx").
 * Only ASCII white space counts, as in the PHP code: a non-breaking space stays.
 *
 * @param {string} text
 * @param {boolean} tex
 * @returns {string}
 */
export function storedCustomTagText( text, tex ) {
    let result = String( text == null ? '' : text );
    if ( tex && /[\r\n]/.test( result ) ) {
        const lines = result.split( /\r\n|\r|\n/ );
        let out = '', afterComment = false;
        lines.forEach( ( line, i ) => {
            if ( afterComment ) {
                line = line.replace( /^[ \t]*/, '' );
                // a control word: letters after an odd number of backslashes (\\alpha is a line break and "alpha")
                const word = /(\\+)[A-Za-z]+$/.exec( out );
                if ( word && word[ 1 ].length % 2 === 1 && /^[A-Za-z]/.test( line ) )
                    out += ' ';
            }
            const last = i === lines.length - 1;
            const comment = last ? -1 : commentStart( line );
            afterComment = comment !== -1;
            out += afterComment ? line.slice( 0, comment ) : line + ( last ? '' : '\n' );
        } );
        result = out;
    }
    return result.replace( /[ \t]*(?:\r\n|\r|\n)[ \t\r\n\f\v]*/g, ' ' );
}

/**
 * The text of the atomic inline custom tag `name` as it is stored (storedCustomTagText()), with the schema's list of
 * TeX source tags.
 */
export function atomicCustomTagText( schema, name, text ) {
    const type = schema && schema.nodes[ ATOM_NAME ];
    const tex = type ? ( type.spec.texSourceNames || [] ).indexOf( name ) !== -1 : false;
    return storedCustomTagText( text, tex );
}

const ATOM_NAME = 'ezCustomInlineAtom';

/** The name of the custom tag an element of the dialect stands for (its first class that is not ezoe's own) */
function elementCustomTagName( element ) {
    return cleanClass( element.getAttribute( 'class' ) ).split( ' ' )[ 0 ] || '';
}

/** Whether an element holds text only (an atomic custom tag with markup inside stays a mark, as it is) */
function holdsTextOnly( element ) {
    return Array.from( element.childNodes ).every( child => child.nodeType === 3 );
}

/**
 * The names of the inline custom tags a schema keeps as one piece (ezCustomInlineAtom), [] when it has none.
 *
 * @param {import('@tiptap/pm/model').Schema} schema
 * @returns {string[]}
 */
export function atomicCustomTagNames( schema ) {
    const type = schema && schema.nodes[ ATOM_NAME ];
    return type ? type.spec.customTagNames || [] : [];
}

/**
 * ezxml <custom name> of an inline custom tag that is one piece (IsInline[name]=true, and the name in the option
 * `names`, from exp_oe_tiptap.ini [EditorSettings] AtomicInlineCustomTags[]): the same
 * <span class="ezoeItemCustomTag NAME" type="custom" customattributes style align>text</span> as the mark
 * ezCustomInline, as an inline atom whose text is the attribute `text`.
 *
 * Formulas are such tags: the text of math_latex is TeX source, the text of math_mathml the spoken form of the
 * MathML in its custom attribute. As a mark the text was ordinary text: a second edit of the tag nested a copy of it,
 * bold around a formula went inside it (the mark of an inline custom tag is the outermost one), two formulas with the
 * same attributes merged, Enter split one and typing after it went into it. As an atom none of this can happen: the
 * text is changed in the custom tag dialog (field Content), formatting and links wrap the whole tag.
 *
 * Only an element holding text only is read as this node; one with markup inside (stored that way) stays the mark,
 * so nothing of it is lost. The HTML is written exactly as the mark writes it.
 */
export const CustomInlineAtom = Node.create( {
    name: ATOM_NAME,
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: true,
    addOptions() {
        return { names: DEFAULT_ATOMIC_INLINE_CUSTOM_TAGS, texSource: DEFAULT_TEX_SOURCE_CUSTOM_TAGS };
    },
    addAttributes() {
        return Object.assign( attributeSet( [ 'class', 'type', 'customattributes', 'style', 'align' ], [ 'tag' ] ), {
            tag: { default: 'span', rendered: false, parseHTML: element => element.nodeName.toLowerCase() === 'u' ? 'u' : 'span' },
            // a line break (pasted, from the source view) is never stored: the text as the server will store it
            text: { default: '', rendered: false, parseHTML: element => storedCustomTagText( element.textContent,
                ( this.options.texSource || [] ).indexOf( elementCustomTagName( element ) ) !== -1 ) }
        } );
    },
    extendNodeSchema( extension ) {
        // leafText: the tag's text in textBetween() (selected text, plain text on the clipboard)
        return extension.name === ATOM_NAME
            ? { leafText: node => node.attrs.text || '', customTagNames: ( extension.options.names || [] ).slice(),
                texSourceNames: ( extension.options.texSource || [] ).slice() }
            : {};
    },
    parseHTML() {
        const names = this.options.names || [];
        const accept = element => ( names.indexOf( elementCustomTagName( element ) ) !== -1 && holdsTextOnly( element ) ? null : false );
        // before the rules of the mark (priority 60)
        return [
            { tag: 'span[type="custom"]', priority: 70, getAttrs: accept },
            { tag: 'u[type="custom"]', priority: 70, getAttrs: accept }
        ];
    },
    renderHTML( { node, HTMLAttributes } ) {
        return [ node.attrs.tag === 'u' ? 'u' : 'span', HTMLAttributes, node.attrs.text || '' ];
    },
    renderText( { node } ) {
        return node.attrs.text || '';
    },
    addCommands() {
        return {
            /** Inserts the atomic inline custom tag `name` with `text` (the selected text when not given) over the selection. */
            insertCustomInlineAtom: ( name, customattributes = null, text = null ) => ( { state, commands } ) => {
                const { from, to } = state.selection;
                const content = atomicCustomTagText( state.schema, name, text !== null ? text : state.doc.textBetween( from, to, '\n' ) );
                return commands.insertContent( {
                    type: this.name,
                    attrs: { tag: name === 'underline' ? 'u' : 'span', class: 'ezoeItemCustomTag ' + name, type: 'custom', customattributes, text: content || '\u00a0' }
                } );
            }
        };
    }
} );

/** The block and inline nodes (tables are in table.js). Paragraph comes first: it is the default block. */
export function ezoeNodes() {
    return [ Document, Text, Paragraph, Heading, HardBreak, BlockBreak, BulletList, OrderedList, ListItem, Literal, Anchor,
             EmbedBlock, EmbedInline, EmbedImage, CustomBlock, CustomImage, CustomInlineAtom ];
}
