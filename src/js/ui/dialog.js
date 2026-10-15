/**
 * Modal dialog of the editor. Skin o2k7 keeps the look of ezoe's inline popups (title bar, gray panel, OK/Cancel);
 * skin a4 (spec.skin) draws the same markup as a card in admin4's look (skin-a4.css): title without a bar, a close
 * button with an icon, stacked fields, the primary button on the right.
 * Both: role="dialog" with aria-modal, aria-labelledby (the title) and aria-describedby (spec.description), focus on
 * the first field, Tab stays inside, Escape cancels, Enter in a single line field presses the primary button, and
 * closing gives the focus back (spec.returnFocus, else the element focused before).
 */
import { h } from './dom.js';

let openCount = 0;

const FOCUSABLE = 'button, input, select, textarea, summary, a[href], [tabindex="0"]';

/** Whether a control can take the focus: not disabled, not inside [hidden] or a closed <details> (its summary can) */
function focusable( el ) {
    if ( el.disabled || el.closest( '[hidden]' ) )
        return false;
    const details = el.closest( 'details' );
    if ( details && !details.open && !( el.tagName === 'SUMMARY' && el.parentNode === details ) )
        return false;
    return true;
}

/**
 * @param {Object} spec { title, description, body: Node|Node[], buttons: [ { text, primary, cancel, onClick( dialog ) } ],
 *                        width, className, skin, closeText, busyText, onClose, returnFocus }
 *                        onClick returns false to keep the dialog open (also the cancel button's, for Escape and ×).
 * @return {Object} { element, panel, close(), setError( text ), setBusy( bool, text ) }
 */
export function openDialog( spec ) {
    const previousFocus = document.activeElement;
    const a4 = spec.skin === 'a4';
    const id = 'exp-oe-dialog-' + ( ++openCount ) + '-' + Date.now();
    const error = h( 'div', { class: 'exp-oe-dialog-error', role: 'alert', hidden: true } );
    const busy = h( 'div', { class: 'exp-oe-dialog-busy', role: 'status', hidden: true } );
    const footer = h( 'div', { class: 'exp-oe-dialog-footer' } );
    const panel = h( 'div', { class: 'exp-oe-dialog-panel' }, [].concat( spec.body || [] ) );
    const description = spec.description ? h( 'p', { id: id + '-desc', class: 'exp-oe-dialog-description', text: spec.description } ) : null;
    const closeText = spec.closeText || 'Close';
    const box = h( 'div', {
        class: 'exp-oe-dialog ' + ( spec.className || '' ), role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': id + '-title', 'aria-describedby': description ? id + '-desc' : null,
        style: spec.width && !a4 ? 'width:' + spec.width + 'px' : null
    }, [
        h( 'div', { class: 'exp-oe-dialog-title' }, [
            h( 'h2', { id: id + '-title', class: 'exp-oe-dialog-heading', text: spec.title || '' } ),
            h( 'button', { type: 'button', class: 'exp-oe-dialog-close', 'aria-label': closeText, title: closeText, onclick: () => cancel() },
               a4 ? h( 'span', { class: 'exp-oe-icon mce_close', 'aria-hidden': 'true' } ) : '×' )
        ] ),
        description, error, busy, panel, footer
    ] );
    const overlay = h( 'div', { class: 'exp-oe-dialog-overlay' + ( spec.skin ? ' exp-oe-skin-' + spec.skin : '' ) }, [ box ] );
    let closed = false;

    const api = {
        element: box,
        panel,
        close() {
            if ( closed )
                return;
            closed = true;
            overlay.remove();
            document.removeEventListener( 'keydown', onKey, true );
            if ( spec.onClose )
                spec.onClose();
            if ( spec.returnFocus )
                spec.returnFocus();
            else if ( previousFocus && previousFocus.focus )
                previousFocus.focus();
        },
        setError( text ) {
            error.textContent = text || '';
            error.hidden = !text;
        },
        setBusy( on, text ) {
            busy.textContent = text || '';
            busy.hidden = !on;
            box.setAttribute( 'aria-busy', on ? 'true' : 'false' );
            for ( const b of footer.querySelectorAll( 'button' ) )
                b.disabled = !!on;
        },
        get closed() {
            return closed;
        }
    };

    const run = ( button ) => {
        api.setError( '' );
        let result;
        try {
            result = button.onClick ? button.onClick( api ) : undefined;
        } catch ( e ) {
            api.setError( e.message );
            return;
        }
        if ( result && typeof result.then === 'function' ) {
            api.setBusy( true, spec.busyText || '' );
            result.then( ( r ) => {
                api.setBusy( false );
                if ( r !== false )
                    api.close();
            }, ( e ) => {
                api.setBusy( false );
                api.setError( e && e.message ? e.message : String( e ) );
            } );
            return;
        }
        if ( result !== false )
            api.close();
    };

    let buttons = spec.buttons || [ { text: 'OK', primary: true } ];
    // a4: secondary buttons first, the primary one last (on the right), in the DOM as on the screen
    if ( a4 )
        buttons = buttons.filter( ( b ) => !b.primary ).concat( buttons.filter( ( b ) => b.primary ) );
    let primary = null, cancelButton = null;
    for ( const b of buttons ) {
        const el = h( 'button', { type: 'button', class: 'exp-oe-dialog-button' + ( b.primary ? ' exp-oe-primary' : '' ), text: b.text, onclick: () => run( b ) } );
        footer.appendChild( el );
        if ( b.primary )
            primary = b;
        if ( b.cancel )
            cancelButton = b;
    }

    // Escape and the close button cancel as the cancel button does; its onClick returns false to keep the dialog open
    function cancel() {
        if ( cancelButton && cancelButton.onClick && cancelButton.onClick( api ) === false )
            return;
        api.close();
    }

    function onKey( e ) {
        if ( !box.isConnected )
            return;
        if ( e.key === 'Escape' ) {
            e.preventDefault();
            e.stopPropagation();
            cancel();
        } else if ( e.key === 'Enter' && primary && e.target && e.target.tagName === 'INPUT' && box.contains( e.target ) &&
                    !/^(file|checkbox|radio|button|submit)$/.test( e.target.type ) ) {
            e.preventDefault();
            run( primary );
        } else if ( e.key === 'Tab' ) {
            // a field whose Tab key inserts an indent (the source view) keeps it, until it is switched off there
            if ( e.target && e.target.getAttribute && e.target.getAttribute( 'data-exp-oe-tab' ) === 'insert' && box.contains( e.target ) )
                return;
            const list = Array.prototype.filter.call( box.querySelectorAll( FOCUSABLE ), focusable );
            if ( !list.length )
                return;
            const first = list[0], last = list[list.length - 1];
            if ( !box.contains( document.activeElement ) ) {
                e.preventDefault();
                ( e.shiftKey ? last : first ).focus();
            } else if ( e.shiftKey && document.activeElement === first ) {
                e.preventDefault();
                last.focus();
            } else if ( !e.shiftKey && document.activeElement === last ) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    document.addEventListener( 'keydown', onKey, true );
    document.body.appendChild( overlay );
    // the first field, else the first control of the panel (a tab, a character), else the primary button
    const inPanel = ( selector ) => Array.prototype.filter.call( panel.querySelectorAll( selector ), focusable );
    const autofocus = inPanel( '[autofocus]' )[0] || inPanel( 'input, select, textarea' )[0] || inPanel( FOCUSABLE )[0] ||
                      footer.querySelector( '.exp-oe-primary' ) || footer.querySelector( 'button' );
    if ( autofocus && autofocus.focus )
        autofocus.focus();
    return api;
}

/**
 * A form row: <label> and control, with an optional hint below it (aria-describedby) and a required mark.
 * options: { required } marks the field as required: aria-required on the control, a "*" in the label that screen
 * readers skip (they announce aria-required).
 */
export function field( label, control, hint, options ) {
    options = options || {};
    const id = control.id || ( 'exp-oe-f-' + Math.random().toString( 36 ).slice( 2 ) );
    control.id = id;
    let hintEl = null;
    if ( hint ) {
        hintEl = h( 'div', { id: id + '-hint', class: 'exp-oe-hint', text: hint } );
        control.setAttribute( 'aria-describedby', id + '-hint' );
    }
    if ( options.required )
        control.setAttribute( 'aria-required', 'true' );
    const check = control.tagName === 'INPUT' && ( control.type === 'checkbox' || control.type === 'radio' );
    return h( 'div', { class: 'exp-oe-field' + ( check ? ' exp-oe-field-check' : '' ) }, [
        h( 'label', { for: id }, [ label, options.required ? h( 'span', { class: 'exp-oe-required', 'aria-hidden': 'true', text: ' *' } ) : null ] ),
        control, hintEl
    ] );
}

/** <select> with [ [ value, text ] ] options */
export function select( options, value, attrs ) {
    return h( 'select', attrs || {}, options.map( ( [ v, text ] ) => h( 'option', { value: v, text, selected: String( v ) === String( value === undefined || value === null ? '' : value ) } ) ) );
}
