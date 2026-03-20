import type { PageServerLoad } from './$types';
import { SessionContext } from '$lib/server/session-context';
import { getApiCatalog, getKeyData } from '$lib/server/util/file-list';

/**
 * FIDO認証チャレンジページサーバーのロード関数。
 * @param {Object} params - SvelteKitのロード関数パラメータ。
 * @param {Cookies} params.cookies - クッキーオブジェクト。
 * @param {App.Locals} params.locals - ローカル変数オブジェクト。
 * @returns {Promise<Object>} ページに渡すプロパティを含むオブジェクト。
 */
export const load: PageServerLoad = async ({ cookies, locals }) => {
    // セッションコンテキストを取得します。
    // 優先順位: locals -> cookies -> 'default-session'
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    
    return {
        // キーデータを取得し、ページプロパティとして展開します。
        ...getKeyData(),
        // APIカタログを取得します。
        apiCatalog: getApiCatalog(),
        // セッションコンテキストを名前と値のペアの形式で取得します。
        sessionContext: SessionContext.getAsNameValues(simses)
    };
};