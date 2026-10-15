<?php
/**
 * Tiptap as an engine of ezoe's editor registry, and what the edit template needs to know about it.
 *
 * There is ONE choice of editor: ezoe's (ezoe.ini [EditorSettings] Engines[], EditorEngine, EngineSwitch, the user
 * preference ezoe_engine and the page ezoe/engine). This extension registers Tiptap there as the engine "tiptap"
 * (settings/ezoe.ini.append.php, class expOETiptapEngine); this class only translates between that choice and the
 * two editors this extension knows, ezoe (TinyMCE, whatever version the site runs) and tiptap.
 *
 *  - resolve():          the editor of the current user (tiptap when ezoe's registry resolves to the engine tiptap)
 *  - setUserEditor():    the switch of 0.1.0 (button exp_oe_switch_<editor>, view exp_oe_tiptap/switch), stored as
 *                        ezoe's preference ezoe_engine
 *  - migratePreference(): moves the preference exp_oe_editor of 0.1.0 to ezoe_engine, once per user
 *  - editorInfo():       the settings of the Tiptap editor for the edit template (the engine's config)
 *  - tokenValid():       the form token check of the switch view
 *  - localRedirect():    the RedirectURI of the switch view, limited to a path on this site
 *
 * @copyright Copyright (C) 1998 - 2026 7x & Exponential Foundation. All rights reserved.
 * @license GNU General Public License v2.0 (or any later version)
 * @package exp_oe_tiptap
 */

class expOETiptapEditor
{
    const EZOE = 'ezoe';
    const TIPTAP = 'tiptap';
    /** The identifier of Tiptap in ezoe's engine registry */
    const ENGINE = 'tiptap';
    /** ezoe's built-in engine, chosen when "ezoe" is asked for on a site whose default engine is Tiptap */
    const EZOE_DEFAULT_ENGINE = 'tinymce3';
    /** The user preference of 0.1.0, read once and moved to ezoe's preference ezoe_engine (migratePreference()) */
    const PREFERENCE = 'exp_oe_editor';
    /** ezoe's user preference, the one choice of editor */
    const ENGINE_PREFERENCE = 'ezoe_engine';
    const INI_FILE = 'exp_oe_tiptap.ini';

    /** @var bool whether migratePreference() ran in this request */
    protected static $migrated = false;

    /** @var array|null cache of policy checks: function => bool */
    protected static $access = null;

    /** @return array the editors this extension knows */
    public static function editors()
    {
        return array( self::EZOE, self::TIPTAP );
    }

    /** @return bool */
    public static function isEditor( $id )
    {
        return is_string( $id ) && in_array( $id, self::editors(), true );
    }

    /** Forgets the migration flag and the access cache (tests, long-running processes such as Velocity). */
    public static function reset()
    {
        self::$migrated = false;
        self::$access = null;
    }

    /** @return bool whether ezoe's engine registry is installed (ezoe 6.0.15 or later) */
    public static function hasRegistry()
    {
        return class_exists( 'expOEEditor' );
    }

    /**
     * The editor of an engine of ezoe's registry.
     *
     * @param mixed $engine an engine identifier
     * @return string tiptap for the engine tiptap, ezoe for every other engine
     */
    public static function editorOfEngine( $engine )
    {
        return $engine === self::ENGINE ? self::TIPTAP : self::EZOE;
    }

    /**
     * The value of ezoe's preference ezoe_engine that stands for an editor of this extension.
     *
     * @param string $editor     ezoe, tiptap, or '' for the site default
     * @param string $configured the engine the site configures (ezoe.ini [EditorSettings] EditorEngine)
     * @return string|null the preference value ('' = the site default), null when the editor is unknown
     */
    public static function engineOfEditor( $editor, $configured )
    {
        if ( $editor === '' )
            return '';
        if ( $editor === self::TIPTAP )
            return self::ENGINE;
        if ( $editor === self::EZOE )
            // the site's own TinyMCE, unless the site default is Tiptap itself
            return $configured === self::ENGINE ? self::EZOE_DEFAULT_ENGINE : '';
        return null;
    }

    /**
     * What the preference exp_oe_editor of 0.1.0 becomes.
     *
     * @param mixed  $legacy     the value of exp_oe_editor (false when the user has none)
     * @param mixed  $current    the value of ezoe_engine (false when the user has none)
     * @param string $configured the engine the site configures
     * The user keeps the editor 0.1.0 showed: there exp_oe_editor=tiptap won over any ezoe_engine, and
     * exp_oe_editor=ezoe showed whatever ezoe_engine chose.
     *
     * @return string|null the value to store as ezoe_engine, null when nothing is stored (no legacy value, ezoe with
     *                     an engine chosen in ezoe already, or ezoe meaning the site default)
     */
    public static function migratedEngine( $legacy, $current, $configured )
    {
        if ( !self::isEditor( $legacy ) )
            return null;
        if ( $legacy === self::TIPTAP )
            return $current === self::ENGINE ? null : self::ENGINE;
        if ( is_string( $current ) && $current !== '' )
            return null;
        $engine = self::engineOfEditor( $legacy, $configured );
        return $engine === '' ? null : $engine;
    }

    /**
     * The engine the switch button of the Tiptap editor goes to: the site's configured engine when that is not
     * Tiptap, else ezoe's built-in engine, else the first other engine.
     *
     * @param array  $choices    identifiers of the other available engines, in registry order
     * @param string $configured the engine the site configures
     * @return string|null null when there is no other engine
     */
    public static function switchTargetOf( array $choices, $configured )
    {
        if ( !$choices )
            return null;
        if ( $configured !== self::ENGINE && in_array( $configured, $choices, true ) )
            return $configured;
        if ( in_array( self::EZOE_DEFAULT_ENGINE, $choices, true ) )
            return self::EZOE_DEFAULT_ENGINE;
        return reset( $choices );
    }

    /** @return string the editor of the current user: tiptap when ezoe's registry resolves to the engine tiptap */
    public static function resolve()
    {
        if ( !self::hasRegistry() )
            return self::EZOE;
        self::migratePreference();
        return self::editorOfEngine( expOEEditor::resolve() );
    }

    /** @return string the other editor than $editor */
    public static function other( $editor )
    {
        return $editor === self::TIPTAP ? self::EZOE : self::TIPTAP;
    }

    /** @return string English name of an editor, translated by the caller (context extension/exp_oe_tiptap) */
    public static function label( $editor )
    {
        return $editor === self::TIPTAP ? 'Tiptap' : 'Online Editor (TinyMCE)';
    }

    /** @return string the editor of users without a choice: tiptap when ezoe.ini [EditorSettings] EditorEngine=tiptap */
    public static function defaultEditor()
    {
        return self::hasRegistry() ? self::editorOfEngine( expOEEditor::configuredEngine() ) : self::EZOE;
    }

    /** @return bool whether editors may switch in the edit form: ezoe.ini [EditorSettings] EngineSwitch=enabled */
    public static function switchEnabled()
    {
        return self::hasRegistry() && expOEEditor::switchEnabled();
    }

    /**
     * @return bool whether the current user may switch: ezoe's EngineSwitch. The policy exp_oe_tiptap/switch of 0.1.0
     *              guards only the view exp_oe_tiptap/switch now; the edit form follows ezoe.
     */
    public static function switchAllowed()
    {
        return self::switchEnabled();
    }

    /** @return string|null the engine the Tiptap editor's switch button goes to, null when there is none */
    public static function switchTarget()
    {
        if ( !self::hasRegistry() )
            return null;
        $choices = array();
        foreach ( expOEEditor::switchChoices( self::ENGINE ) as $choice )
            $choices[] = $choice['identifier'];
        return self::switchTargetOf( $choices, expOEEditor::configuredEngine() );
    }

    /**
     * What the Tiptap editor template needs (the config of the engine tiptap, $input_handler.engine.config).
     *
     * @return array editor, label, other, other_label, can_switch, switch_action, tiptap_available, ai_enabled,
     *               ai_commands, scripts, styles, asset_loading, cache_key, min_height, upload_extensions,
     *               upload_from_url, i18n
     */
    public static function editorInfo()
    {
        $editor = self::resolve();
        $target = self::switchEnabled() ? self::switchTarget() : null;
        $labels = self::hasRegistry() ? expOEEditor::labels() : array();
        if ( $editor === self::TIPTAP )
        {
            $other = $target === null ? self::EZOE : self::editorOfEngine( $target );
            $otherLabel = $target !== null && isset( $labels[$target] ) ? $labels[$target] : ezpI18n::tr( 'extension/exp_oe_tiptap', self::label( $other ) );
            $action = $target === null ? '' : 'switch_engine_' . $target;
        }
        else
        {
            $other = self::TIPTAP;
            $otherLabel = ezpI18n::tr( 'extension/exp_oe_tiptap', self::label( self::TIPTAP ) );
            $action = 'switch_engine_' . self::ENGINE;
        }
        return array(
            'editor'           => $editor,
            'label'            => ezpI18n::tr( 'extension/exp_oe_tiptap', self::label( $editor ) ),
            'other'            => $other,
            'other_label'      => $otherLabel,
            'can_switch'       => self::switchAllowed() && $action !== ''
                                  && ( $other !== self::TIPTAP || self::tiptapAvailable() ),
            'switch_action'    => $action,
            'tiptap_available' => self::tiptapAvailable(),
            'ai_enabled'       => self::aiAllowed(),
            'ai_commands'      => self::aiCommands(),
            'scripts'          => self::scripts(),
            'styles'           => self::styles(),
            'asset_loading'    => self::setting( 'EditorSettings', 'AssetLoading', 'ezdesign' ) === 'ezjscore' ? 'ezjscore' : 'ezdesign',
            'cache_key'        => self::cacheKey(),
            'min_height'       => (int) self::setting( 'EditorSettings', 'MinHeight', 300 ),
            // the upload rules of ezoe's embed dialog (ezoe.ini [EditorSettings] UploadFileExtensions[], UploadFromUrl)
            'upload_extensions' => self::hasRegistry() ? expOEEditor::uploadExtensions() : array(),
            'upload_from_url'   => class_exists( 'expOEUrlFetcher' ) ? (bool) expOEUrlFetcher::enabled() : false,
            'i18n'              => self::translations(),
        );
    }

    /** @return bool whether the current user may use the AI commands: [AISettings] Enabled and exp_oe_tiptap/ai */
    public static function aiAllowed()
    {
        return self::setting( 'AISettings', 'Enabled', 'false' ) === 'true' && self::currentUserHasAccess( 'ai' );
    }

    /** @return array [AISettings] Commands[] */
    public static function aiCommands()
    {
        return array_values( array_filter( (array) self::setting( 'AISettings', 'Commands', array() ), 'strlen' ) );
    }

    /** @var array the English texts of the editor every page gets translated; the bundle's strings.json adds its own */
    protected static $strings = array(
        'Switch to %editor', 'Editing with %editor', 'Online Editor (TinyMCE)', 'Tiptap',
        'Bold', 'Italic', 'Underline', 'Subscript', 'Superscript', 'Paragraph', 'Preformatted',
        'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5', 'Heading 6',
        'Bullet list', 'Numbered list', 'Indent', 'Outdent', 'Undo', 'Redo', 'Link', 'Remove link', 'Unlink', 'Anchor',
        'Image', 'Object', 'File', 'Custom tag', 'Literal', 'Literal text', 'Table', 'Paste as text', 'Full screen', 'Source',
        'Format', 'Path', 'Editor toolbar', 'Drag to resize', 'OK', 'Cancel', 'Remove formatting',
        'Insert/edit link', 'Insert/edit anchor', 'Insert/edit image', 'Insert/edit object', 'Insert/edit file',
        'Insert/edit table', 'Insert custom tag', 'Insert page break', 'Insert special character', 'Table cell properties',
        'Toggle fullscreen mode', 'Store draft (Ctrl+S)', 'Send for publishing', 'Discard draft', 'Help (Alt+0)',
        'Undo (Ctrl+Z)', 'Redo (Ctrl+Y)',
        'AI', 'AI assistant', 'Accept', 'Reject', 'Improve writing', 'Make shorter', 'Make longer', 'Fix spelling and grammar',
        'Translate', 'Summarize', 'Continue writing',
    );

    /**
     * The editor's texts, translated (context extension/exp_oe_tiptap): English text => translation, the form
     * options.i18n has. The texts are the list above plus the JSON list strings.json the build may write next to
     * the bundle (every text the bundle passes to its translator). Placeholders such as %editor stay in place.
     *
     * @return array
     */
    public static function translations()
    {
        $sources = self::$strings;
        $scripts = self::scripts();
        if ( $scripts )
        {
            $file = dirname( __DIR__ ) . '/design/standard/javascript/' . dirname( ltrim( $scripts[0], '/' ) ) . '/strings.json';
            $more = is_file( $file ) ? json_decode( (string) file_get_contents( $file ), true ) : null;
            if ( is_array( $more ) )
                $sources = array_merge( $sources, array_filter( $more, 'is_string' ) );
        }
        $translations = array();
        foreach ( array_unique( $sources ) as $source )
            $translations[$source] = ezpI18n::tr( 'extension/exp_oe_tiptap', $source );
        return $translations;
    }

    /** @return array design paths below javascript/ of the built scripts ([EditorSettings] Scripts[]) */
    public static function scripts()
    {
        return array_values( array_filter( (array) self::setting( 'EditorSettings', 'Scripts', array() ), 'strlen' ) );
    }

    /** @return array design paths below stylesheets/ of the built styles ([EditorSettings] Styles[]) */
    public static function styles()
    {
        return array_values( array_filter( (array) self::setting( 'EditorSettings', 'Styles', array() ), 'strlen' ) );
    }

    /** @return string|false absolute file of the bundle (the first script), false when it is missing */
    public static function bundleFile()
    {
        $scripts = self::scripts();
        if ( !$scripts )
            return false;
        $file = dirname( __DIR__ ) . '/design/standard/javascript/' . ltrim( $scripts[0], '/' );
        return is_file( $file ) ? $file : false;
    }

    /** @return bool whether Tiptap can run: its bundle has been built */
    public static function tiptapAvailable()
    {
        return self::bundleFile() !== false;
    }

    /** @return string a short key that changes whenever a built file changes (no longer put on the asset URLs, which carry no version query) */
    public static function cacheKey()
    {
        $times = array();
        foreach ( self::scripts() as $path )
            $times[] = @filemtime( dirname( __DIR__ ) . '/design/standard/javascript/' . ltrim( $path, '/' ) );
        foreach ( self::styles() as $path )
            $times[] = @filemtime( dirname( __DIR__ ) . '/design/standard/stylesheets/' . ltrim( $path, '/' ) );
        return substr( md5( implode( ',', $times ) ), 0, 10 );
    }

    /**
     * Stores the editor of the current user as ezoe's preference ezoe_engine (the switch of 0.1.0: the button
     * exp_oe_switch_<editor> and the view exp_oe_tiptap/switch end here, so there is one choice).
     *
     * @param string $editor ezoe, tiptap, or '' to go back to the site default
     * @return bool false when the editor is unknown or Tiptap is not available
     */
    public static function setUserEditor( $editor )
    {
        if ( !self::hasRegistry() || !is_string( $editor ) )
            return false;
        $engine = self::engineOfEditor( $editor, expOEEditor::configuredEngine() );
        if ( $engine === null )
            return false;
        if ( $engine !== '' && !expOEEditor::hasEngine( $engine ) )
            return false;
        if ( !expOEEditor::setUserEngine( $engine ) )
            return false;
        self::forgetLegacyPreference();
        return true;
    }

    /**
     * Moves the preference exp_oe_editor of 0.1.0 to ezoe's ezoe_engine for the current user, once: tiptap becomes
     * ezoe_engine=tiptap (unless the user chose in ezoe already), ezoe means the site default, and the old
     * preference is emptied. Runs at most once per request; bin/php/migrate_editor_preference.php moves every user.
     *
     * @return bool whether something was moved
     */
    public static function migratePreference()
    {
        if ( self::$migrated || !self::hasRegistry() )
            return false;
        self::$migrated = true;
        $legacy = eZPreferences::value( self::PREFERENCE );
        if ( !is_string( $legacy ) || $legacy === '' )
            return false;
        $engine = self::migratedEngine( $legacy, eZPreferences::value( self::ENGINE_PREFERENCE ), expOEEditor::configuredEngine() );
        if ( $engine !== null )
            eZPreferences::setValue( self::ENGINE_PREFERENCE, $engine );
        self::forgetLegacyPreference();
        return $engine !== null;
    }

    /** Empties the preference exp_oe_editor of the current user, when there is one. */
    protected static function forgetLegacyPreference()
    {
        $legacy = eZPreferences::value( self::PREFERENCE );
        if ( is_string( $legacy ) && $legacy !== '' )
            eZPreferences::setValue( self::PREFERENCE, '' );
    }

    /**
     * Compares a posted form token with the expected one, in constant time.
     *
     * @param string|null $expected
     * @param mixed       $given
     * @return bool false when either is empty
     */
    public static function tokensMatch( $expected, $given )
    {
        return is_string( $expected ) && $expected !== '' && is_string( $given ) && $given !== ''
            && hash_equals( $expected, $given );
    }

    /** @return string|null the form token of this session (ezformtoken), null when ezformtoken is not installed */
    public static function expectedToken()
    {
        return class_exists( 'ezxFormToken' ) ? ezxFormToken::getToken() : null;
    }

    /**
     * The form token check of the switch view: the field ezxform_token, else the X-CSRF-Token header, against the
     * session's token. Without ezformtoken nothing can be checked and the switch is refused.
     *
     * @param array $post   $_POST
     * @param array $server $_SERVER
     * @param string|null $expected the token of this session, read from ezformtoken when null
     * @return bool
     */
    public static function tokenValid( array $post, array $server, $expected = null )
    {
        if ( $expected === null )
            $expected = self::expectedToken();
        $given = null;
        if ( isset( $post['ezxform_token'] ) )
            $given = $post['ezxform_token'];
        else if ( isset( $server['HTTP_X_CSRF_TOKEN'] ) )
            $given = $server['HTTP_X_CSRF_TOKEN'];
        return self::tokensMatch( $expected, $given );
    }

    /**
     * A redirect target of the switch view, limited to a path on this site (no scheme, no host, no //).
     *
     * @param mixed  $uri
     * @param string $fallback
     * @return string
     */
    public static function localRedirect( $uri, $fallback = '/' )
    {
        if ( !is_string( $uri ) || $uri === '' || $uri[0] !== '/' )
            return $fallback;
        if ( strpos( $uri, '//' ) === 0 || strpos( $uri, '/\\' ) === 0 || preg_match( '/[\x00-\x1f\x7f]/', $uri ) )
            return $fallback;
        return $uri;
    }

    /** @return bool whether the current user has the policy exp_oe_tiptap/<function> (any limitation counts) */
    public static function currentUserHasAccess( $function )
    {
        if ( isset( self::$access[$function] ) )
            return self::$access[$function];
        $allowed = false;
        $user = eZUser::currentUser();
        if ( $user instanceof eZUser )
        {
            $result = $user->hasAccessTo( 'exp_oe_tiptap', $function );
            $allowed = $result['accessWord'] !== 'no';
        }
        self::$access[$function] = $allowed;
        return $allowed;
    }

    /** @return mixed a setting of exp_oe_tiptap.ini, $default when it is not set */
    public static function setting( $block, $name, $default = null )
    {
        $ini = eZINI::instance( self::INI_FILE );
        return $ini->hasVariable( $block, $name ) ? $ini->variable( $block, $name ) : $default;
    }
}
