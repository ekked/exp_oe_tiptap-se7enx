/**
 * Keyboard shortcuts as the platform names them.
 *
 * The texts name shortcuts the Windows way ("Ctrl+F", "Ctrl+Shift+V", "Alt+0"; translated: "Strg+F",
 * "Strg+Umschalt+V"), and every key binding of the editor uses Tiptap's "Mod-", which is Cmd on a Mac and Ctrl
 * elsewhere. On a Mac the texts would tell the user to press Ctrl+F, which types into the text there. formatKeys()
 * writes every shortcut of a text the way the platform does: on a Mac with the symbols of its menus in their order
 * (⌃⌥⇧⌘, "⇧⌘V"), elsewhere unchanged but for the names of the modifier keys in the user's language.
 *
 * "Ctrl" in a text means the key the binding's "Mod-" stands for. Where a text means the Control key itself (Ctrl+M
 * in the source view's field, Ctrl with a right click for the browser's own menu), formatKeys() is called with
 * { control: true } and writes ⌃ on a Mac.
 *
 * @license GPL-2.0-or-later
 */

/** The same test as ProseMirror's keymap, which decides what "Mod-" means */
export function isMac( nav ) {
    const n = nav || ( typeof navigator !== 'undefined' ? navigator : null );
    return !!n && /Mac|iP(hone|[oa]d)/.test( n.platform || '' );
}

/** modifier names of the texts, English and German -> the modifier */
const MODIFIERS = { Ctrl: 'mod', Strg: 'mod', Cmd: 'mod', Shift: 'shift', Umschalt: 'shift', Alt: 'alt' };

/** a shortcut: one or more modifiers joined by "+", then the key (a letter, a digit, F10, a word such as Space) */
const COMBO = /(^|[^\w+])((?:(?:Ctrl|Strg|Cmd|Shift|Umschalt|Alt)\+)+)([^\s+,;:()\/.]+)/g;

/** the order of the Mac's menus */
const MAC_ORDER = [ 'ctrl', 'alt', 'shift', 'mod' ];
const MAC_SYMBOL = { ctrl: '⌃', alt: '⌥', shift: '⇧', mod: '⌘' };

/**
 * @param {string} text
 * @param {object} [options]
 * @param {boolean} [options.mac]     write the Mac's symbols (default: isMac())
 * @param {boolean} [options.control] "Ctrl" is the Control key, not the binding's "Mod-" (⌃ on a Mac)
 * @param {object}  [options.names]   names of the modifiers off the Mac: { Ctrl, Shift, Alt } (translated)
 * @returns {string}
 */
export function formatKeys( text, options = {} ) {
    if ( typeof text !== 'string' || text.indexOf( '+' ) === -1 )
        return text;
    const mac = options.mac === undefined ? isMac() : !!options.mac;
    const names = options.names || {};
    return text.replace( COMBO, ( all, before, modifiers, key ) => {
        const list = modifiers.split( '+' ).filter( Boolean ).map( ( m ) => {
            const kind = MODIFIERS[m];
            return kind === 'mod' && options.control ? 'ctrl' : kind;
        } );
        if ( !mac ) {
            const name = { mod: names.Ctrl || 'Ctrl', ctrl: names.Ctrl || 'Ctrl', shift: names.Shift || 'Shift', alt: names.Alt || 'Alt' };
            return before + list.map( ( m ) => name[m] ).join( '+' ) + '+' + key;
        }
        const symbols = MAC_ORDER.filter( ( m ) => list.indexOf( m ) !== -1 ).map( ( m ) => MAC_SYMBOL[m] ).join( '' );
        return before + symbols + ( key.length === 1 ? key.toUpperCase() : key );
    } );
}

/**
 * The key names a shortcut list shows (the help's keyboard table), translated by t; the modifiers are formatKeys()'s.
 * Each name is written out as t( '...' ) so the build finds it for the translation file.
 */
export function keyNames( t ) {
    return {
        Ctrl: t( 'Ctrl' ), Shift: t( 'Shift' ), Alt: t( 'Alt' ), Space: t( 'Space' ), Enter: t( 'Enter' ),
        Escape: t( 'Escape' ), Delete: t( 'Delete' ), Up: t( 'Up' ), Down: t( 'Down' )
    };
}

const KEY_WORDS = /\b(Space|Enter|Escape|Delete|Up|Down)\b/g;

/**
 * A shortcut as written in a list of keys ("Ctrl+Shift+Space", "Alt+Shift+Up / Down"): the key names translated,
 * then formatted for the platform.
 *
 * @param {string} keys
 * @param {function} t the translator (ui/dom.js translator(), which knows the platform)
 * @param {object} [options] as formatKeys()
 */
export function shortcutLabel( keys, t, options = {} ) {
    const names = keyNames( t );
    const words = keys.replace( KEY_WORDS, ( w ) => names[w] );
    return typeof t.keys === 'function' ? t.keys( words, options ) : formatKeys( words, Object.assign( { names }, options ) );
}
