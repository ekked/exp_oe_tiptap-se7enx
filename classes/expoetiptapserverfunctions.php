<?php
/**
 * File containing the expOETiptapServerFunctions class.
 *
 * @copyright Copyright (C) 7x & Exponential Foundation. All rights reserved.
 * @license GNU General Public License v2.0 (or any later version)
 * @package exp_oe_tiptap
 */

/**
 * ezjscore server functions of the Tiptap editor (ezjscore.ini [ezjscServer_expoetiptap]).
 *
 *   POST <root>/ezjscore/call  ezjscServer_function_arguments=expoetiptap::ai
 *        ezxform_token (or header X-CSRF-Token), command, text, language (translate), locale,
 *        format (text | markup), strict (1 on the second try),
 *        contentObjectId, version, attributeId, languageCode (the edited field, optional)
 *   -> { error_text, content: { text, command, model } }
 *
 * Checks [AISettings] Enabled, the policy exp_oe_tiptap/ai, POST and the form token itself, then calls the configured
 * provider server side. The token is always required: ezformtoken's when ezformtoken is active (which checks it too),
 * else the session token of this extension the editor template renders (expOETiptapEditor::expectedToken()). The API
 * key never leaves the server.
 *
 * When the request names the edited field (contentObjectId, version, attributeId), the user must be allowed to edit
 * that object and the attribute must belong to it; the provider then knows the content (expai's data policy and usage
 * log use it, Provider=expai).
 */
class expOETiptapServerFunctions extends ezjscServerFunctions
{
    /**
     * @param array $args unused
     * @return array
     * @throws expOETiptapAIException
     */
    public static function ai( $args )
    {
        try
        {
            $service = expOETiptapAIService::fromINI();
            $service->checkRequest(
                isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : '',
                self::givenToken(),
                expOETiptapEditor::expectedToken(),
                self::hasPolicy()
            );
            $service->setRequestContext( self::contentContext( self::requestIds( $_POST ) ) );
            $post = static function ( $name )
            {
                return isset( $_POST[$name] ) && is_string( $_POST[$name] ) ? $_POST[$name] : '';
            };
            return $service->run( $post( 'command' ), $post( 'text' ), $post( 'language' ), $post( 'locale' ), $post( 'format' ), $post( 'strict' ) === '1' );
        }
        catch ( expOETiptapAIException $e )
        {
            // the editor reads the message in the language of the siteaccess (context extension/exp_oe_tiptap)
            throw $e->translated();
        }
    }

    /** @return string|null */
    protected static function givenToken()
    {
        if ( isset( $_POST['ezxform_token'] ) && is_string( $_POST['ezxform_token'] ) && $_POST['ezxform_token'] !== '' )
            return $_POST['ezxform_token'];
        if ( !empty( $_SERVER['HTTP_X_CSRF_TOKEN'] ) && is_string( $_SERVER['HTTP_X_CSRF_TOKEN'] ) )
            return $_SERVER['HTTP_X_CSRF_TOKEN'];
        return null;
    }

    /**
     * The ids of the edited field in a request, as numbers (0 when missing or not a positive number).
     *
     * @param array $post
     * @return array object_id, version, attribute_id (int), language (string, '' when missing or not a language code)
     */
    public static function requestIds( array $post )
    {
        $id = static function ( $name ) use ( $post )
        {
            return isset( $post[$name] ) && is_string( $post[$name] ) && preg_match( '/^[1-9][0-9]{0,9}$/', $post[$name] ) ? (int) $post[$name] : 0;
        };
        $language = isset( $post['languageCode'] ) && is_string( $post['languageCode'] ) && preg_match( '/^[a-z]{2,3}-[A-Z]{2}$/', $post['languageCode'] )
                  ? $post['languageCode'] : '';
        return array( 'object_id' => $id( 'contentObjectId' ), 'version' => $id( 'version' ), 'attribute_id' => $id( 'attributeId' ), 'language' => $language );
    }

    /**
     * Checks the edited field the request names: the user may edit the object, and the attribute (when named) is one
     * of its attributes in that version.
     *
     * @param array $ids requestIds()
     * @return array the ids for the provider; empty when the request names no object
     * @throws expOETiptapAIException
     */
    protected static function contentContext( array $ids )
    {
        if ( $ids['object_id'] <= 0 )
            return array();
        $object = eZContentObject::fetch( $ids['object_id'] );
        if ( !$object instanceof eZContentObject || !$object->canEdit( false, false, false, $ids['language'] !== '' ? $ids['language'] : false ) )
            throw new expOETiptapAIException( 'You are not allowed to edit this content.', 'no edit access to the object of the request' );
        if ( $ids['attribute_id'] > 0 )
        {
            $attribute = $ids['version'] > 0 ? eZContentObjectAttribute::fetch( $ids['attribute_id'], $ids['version'] ) : null;
            if ( !$attribute instanceof eZContentObjectAttribute || (int) $attribute->attribute( 'contentobject_id' ) !== $ids['object_id'] )
                throw new expOETiptapAIException( 'The field does not belong to this content.', 'attribute and object of the request do not match' );
        }
        return $ids;
    }

    /** @return bool the current user has the policy exp_oe_tiptap/ai (any limitation counts as yes) */
    protected static function hasPolicy()
    {
        $user = eZUser::currentUser();
        if ( !$user instanceof eZUser )
            return false;
        $access = $user->hasAccessTo( 'exp_oe_tiptap', 'ai' );
        return isset( $access['accessWord'] ) && $access['accessWord'] !== 'no';
    }

    /** No caching of AI answers */
    public static function getCacheTime( $functionName )
    {
        return 0;
    }
}
