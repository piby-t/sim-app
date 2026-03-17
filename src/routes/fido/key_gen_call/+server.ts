import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SimHttp } from '$lib/util/sim-http';
import { HistoryManager } from '$lib/server/history-manager';
import { ExecutorFactory } from '$lib/server/executor/ExecutorFactory';
import type { SimRes, SimReq } from '$lib/types';

export const POST: RequestHandler = async ({ request, cookies, locals, fetch }) => {
    const simses = locals.simses || cookies.get('simses') || 'default-session';
    const { method, url, headers, body, isUrlEncoded } = await request.json();

    const simReq: SimReq = { kind: "API", method, url, header: headers, body: body };
    const simHttp = new SimHttp(simReq);
    let simRes: SimRes;

    try {
        const executor = ExecutorFactory.create(fetch);
        const response = await executor.execute({ method, url, headers, body, isUrlEncoded });
        simRes = { kind: "FIDO", status: response.status, header: response.headers, body: response.body };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        simRes = { kind: "FIDO", status: 500, header: [], body: `Execution Error: ${msg}` };
    }

    simHttp.setResponse(simRes);
    HistoryManager.addRecord(simses, simHttp);

    return json({ success: true });
};