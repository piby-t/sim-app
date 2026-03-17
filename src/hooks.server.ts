import type { Handle } from '@sveltejs/kit';

// このファイル内でのみ使用する定数
const COOKIE_NAME_SIMSES = 'simses';

export const handle: Handle = async ({ event, resolve }) => {
    // 1. CookieからセッションIDを取得
    let simses = event.cookies.get(COOKIE_NAME_SIMSES);

    // 2. 存在しない場合は新規UUIDを発行
    if (!simses) {
        simses = crypto.randomUUID();
        
        // Cookieのセット（セッションを維持するための設定）
        event.cookies.set(COOKIE_NAME_SIMSES, simses, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24
        });
    }

    // 3. サーバーサイドの各処理で利用できるよう locals に格納
    event.locals.simses = simses;

    const response = await resolve(event);
    return response;
};