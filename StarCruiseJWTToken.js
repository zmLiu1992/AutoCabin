function starCruiseNotify(subtitle = '', message = '') {
    $notification.post('[StarCruise] 金鑰', subtitle, message, {
        'url': ''
    });
};

const STORE_KEY = "StarCruise_JWT_Token";

if (!$response?.body) {
    $done({});
}

let json;
try {
    json = JSON.parse($response.body);
} catch {
    starCruiseNotify('解析失敗 ‼️', '請重新登入');
    $done({});
}

const accessToken = json?.accessToken;
const refreshToken = json?.refreshToken;

if (typeof accessToken === "string" && accessToken.length &&
    typeof refreshToken === "string" && refreshToken.length) {

    const payload = {
        accessToken,
        refreshToken,
        user: {
            sub: json?.user?.sub ?? null,
            dpiHiFai: json?.user?.dpiHiFai ?? null
        },
        capturedAt: new Date().toISOString()
    };

    const isSaveTokenSuccess = $persistentStore.write(JSON.stringify(payload), STORE_KEY);
    if (isSaveTokenSuccess) {
        starCruiseNotify('保存成功', '');
    } else {
        starCruiseNotify('保存失敗 ‼️', '請重新登入');
    }
}

$done({});