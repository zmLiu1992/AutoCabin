 function starCruiseNotify(subtitle = '', message = '') {
   $notification.post('[StarCruise] 看門狗', subtitle, message, {
     'url': ''
   });
 };

 function quickDisplay(result = '') {

   // 捷徑名稱（請先在捷徑 App 建一個同名捷徑）
   const shortcutName = "StarCruise顯示";

   // Shortcuts URL scheme（把 result 當作捷徑輸入）
   const url =
     "shortcuts://run-shortcut?name=" +
     encodeURIComponent(shortcutName) +
     "&input=" +
     encodeURIComponent(result);

   // 發一則可操作的通知：點了就打開捷徑並把值丟進去
   $notification.post(
     "[StarCruise] 房間查詢完成",
     "點擊這則通知以開啟捷徑，顯示完整結果",
     result, {
       action: "open-url", // 點通知後執行「開網址」
       url, // 這個網址就是上面的 shortcuts://...
       sound: true, //（可選）有提示音
       "auto-dismiss": 0 //（可選）0 代表不自動消失
     }
   );
 }

 function notifyFoundCabin(result = '') {

   // 捷徑名稱（請先在捷徑 App 建一個同名捷徑）
   const shortcutName = "StarCruise顯示";

   // Shortcuts URL scheme（把 result 當作捷徑輸入）
   const url =
     "shortcuts://run-shortcut?name=" +
     encodeURIComponent(shortcutName) +
     "&input=" +
     encodeURIComponent(result);

   // 發一則可操作的通知：點了就打開捷徑並把值丟進去
   $notification.post(
     "[StarCruise] 看門狗",
     "找到房間",
     result, {
       action: "open-url", // 點通知後執行「開網址」
       url, // 這個網址就是上面的 shortcuts://...
       sound: true, //（可選）有提示音
       "auto-dismiss": 0 //（可選）0 代表不自動消失
     }
   );
 }

 function quickLogin() {
   // 捷徑名稱（請先在捷徑 App 建一個同名捷徑）
   const shortcutName = "StarCruise登入";

   // Shortcuts URL scheme（把 result 當作捷徑輸入）
   const url =
     "shortcuts://run-shortcut?name=" +
     encodeURIComponent(shortcutName) +
     "&input=" +
     encodeURIComponent('');

   // 發一則可操作的通知：點了就打開捷徑並把值丟進去
   $notification.post(
     "[StarCruise] 金鑰失效",
     `點擊重新登入`,
     '', {
       action: "open-url", // 點通知後執行「開網址」
       url, // 這個網址就是上面的 shortcuts://...
       sound: true, //（可選）有提示音
       "auto-dismiss": 0 //（可選）0 代表不自動消失
     }
   );
 }

 const STORE_KEY = "StarCruise_JWT_Token";
 const PORT_KEY = "StarCruise_portNum";
 const PAX_KEY = "StarCruise_paxNum";
 const CHECK_DAY_KEY = "StarCruise_day";
 const SKIP_DATE_KEY = "StarCruise_skipDate";
 const ENABLE_NOTIFY_KEY = "StarCruise_enableNotify";

 const cabinName_Balcony = "Balcony Stateroom";
 const cabinName_Oceanview = "Oceanview Stateroom";
 const cabinName_Interior = "Interior Stateroom";


 function getJwtTokens() {
   const tokenCollection = $persistentStore.read(STORE_KEY);
   if (tokenCollection == null) {
     return null;
   }

   try {
     return JSON.parse(tokenCollection);
   } catch {
     return null;
   }
 }

 function deleteJwtTokens() {
   $persistentStore.write(null, STORE_KEY);
 }

 function refreshJwtTokens() {
   const tokens = getJwtTokens();
   if (tokens == null) {
     deleteJwtTokens();
     quickLogin();
     return Promise.reject(new RetryError("Token missing"));
   }

   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: 'https://backend-prd.b2m.stardreamcruises.com/auth/customer/refresh',
       headers: {
         'authorization': `Bearer ${tokens.refreshToken}`
       }
     };

     $httpClient.get(requestUrl, function(error, response, body) {
       if (error) {
         reject(new Error("Refresh network error"));
         return;
       }

       if (response.status === 200) {
         try {
           const datas = JSON.parse(body);
           updateJwtToken(datas);
           reject(new RetryError("Token refreshed")); // 觸發外層重跑
           return;
         } catch (e) {
           deleteJwtTokens();
           quickLogin();
           reject(new RetryError("Refresh parse error"));
           return;
         }
       }

       deleteJwtTokens();
       quickLogin();
       reject(new RetryError("Refresh failed status=" + response.status));
     });
   });
 }


 function updateJwtToken(json) {
   const accessToken = json && json.accessToken;
   const refreshToken = json && json.refreshToken;
   const user = (json && json.user) ? json.user : {};

   const sub = (user && user.sub) ? user.sub : null;
   const dpiHiFai = (user && user.dpiHiFai) ? user.dpiHiFai : null;

   if (typeof accessToken === "string" && accessToken.length &&
     typeof refreshToken === "string" && refreshToken.length) {

     const payload = {
       accessToken: accessToken,
       refreshToken: refreshToken,
       user: {
         sub: sub,
         dpiHiFai: dpiHiFai
       },
       capturedAt: new Date().toISOString()
     };

     $persistentStore.write(JSON.stringify(payload), STORE_KEY);
     // starCruiseNotify('更新金鑰成功', '');
   }
 }

 function getCustomerInfo(retried = false) {
   const tokens = getJwtTokens();
   if (tokens == null) {
     //starCruiseNotify('金鑰不存在 ‼️', '請重新登入');
     return null;
   }

   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: 'https://backend-prd.b2m.stardreamcruises.com/auth/customer/report',
       headers: {
         'authorization': `Bearer ${tokens.accessToken}`,
       }
     };

     $httpClient.get(requestUrl, function(error, response, body) {
       if (error) {
         starCruiseNotify('旅客資訊查詢失敗 ‼️', '連線錯誤');
         resolve(null);

       } else {
         if (response.status === 200) {
           try {
             const datas = JSON.parse(body);
             const info = `剩餘客房點數：${datas.cabin_credits} P`;
             resolve(info);

           } catch (e) {
             starCruiseNotify('旅客資訊查詢失敗 ‼️', String(e));
             resolve(null);
           }
         } else if (response.status === 401) {
           if (!retried) {
             refreshJwtTokens()
               .then(() => {
                 // 用新 token 立刻重打一次（你可以把 request 包成一個 inner function）
                 resolve(getCustomerInfo(true));
               })
               .catch(reject);
             return;
           } else {
             reject(new Error(`getCustomerInfo failed, status=${response.status}`));
           }
         } else {
           starCruiseNotify('Token 已過期 ‼️', `(${response.status}) 請重新登入`);
           resolve(null);
         }
       }
     });
   });
 }

 function getPortInfos() {
   const tokens = getJwtTokens();
   if (tokens == null) {
     starCruiseNotify('金鑰不存在 ‼️', '請重新登入');
     return null;
   }

   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: 'https://backend-prd.b2m.stardreamcruises.com/customers/list/port?lang=hant&page=1',
       headers: {
         'authorization': `Bearer ${tokens.accessToken}`,
       }
     };

     $httpClient.get(requestUrl, function(error, response, body) {
       if (error) {
         starCruiseNotify('港口清單查詢失敗 ‼️', '連線錯誤');
         resolve(null);

       } else {
         if (response.status === 200) {
           try {
             const datas = JSON.parse(body);
             const portDictionary = datas.items
               .filter(item => item.status === true)
               .reduce((acc, item) => {
                 acc[String(item.id)] = item.traditional_chinese_port_name;
                 return acc;
               }, {});

             resolve(portDictionary);

           } catch (e) {
             starCruiseNotify('港口清單查詢失敗 ‼️', String(e));
             resolve(null);

           }
         } else if (response.status === 401) {
           refreshJwtTokens().catch(reject);
           return;

         } else {
           starCruiseNotify('Cookie 已過期 ‼️', `(${response.status}) 請重新登入`);
           resolve(null);
         }
       }
     });
   });
 }

 function getDepartureDates(portNum) {
   const tokens = getJwtTokens();
   if (tokens == null) {
     starCruiseNotify('金鑰不存在 ‼️', '請重新登入');
     return null;
   }

   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: `https://backend-prd.b2m.stardreamcruises.com/customers/list/departure-date?departure_port=${portNum}&lang=hant`,
       headers: {
         'authorization': `Bearer ${tokens.accessToken}`,
       }
     };

     $httpClient.get(requestUrl, function(error, response, body) {
       if (error) {
         starCruiseNotify('出發日查詢失敗 ‼️', '連線錯誤');
         resolve(null);

       } else {
         if (response.status === 200) {
           try {
             const datas = JSON.parse(body);
             resolve(datas);
           } catch (e) {
             starCruiseNotify('出發日查詢失敗 ‼️', String(e));
             resolve(null);
           }
         } else if (response.status === 401) {
           refreshJwtTokens().catch(reject);
           return;

         } else {
           starCruiseNotify('Cookie 已過期 ‼️', `(${response.status}) 請重新登入`);
           resolve(null);
         }
       }
     });
   });
 }

 function getItinerary(portNum, departureDate) {
   const tokens = getJwtTokens();
   if (tokens == null) {
     starCruiseNotify('金鑰不存在 ‼️', '請重新登入');
     return null;
   }

   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: `https://backend-prd.b2m.stardreamcruises.com/customers/list/itinerary?port_id=${portNum}&departure_date=${departureDate}&lang=hant&page=1`,
       headers: {
         'authorization': `Bearer ${tokens.accessToken}`,
       }
     };

     $httpClient.get(requestUrl, function(error, response, body) {
       if (error) {
         starCruiseNotify('出航查詢失敗 ‼️', '連線錯誤');
         resolve(null);

       } else {
         if (response.status === 200) {
           try {
             const jsonData = JSON.parse(body);
             if (jsonData.items && jsonData.items.length > 0) {
               resolve(jsonData.items[0].traditional_chinese_name);
             } else {
               resolve('');
             }

           } catch (e) {
             starCruiseNotify('出航查詢失敗 ‼️', String(e));
             resolve(null);
           }
         } else if (response.status === 401) {
           refreshJwtTokens().catch(reject);
           return;

         } else {
           starCruiseNotify('Cookie 已過期 ‼️', `(${response.status}) 請重新登入`);
           resolve(null);
         }
       }
     });
   });
 }

 function checkCabin(portNum, departureDate, itineraryName, persons, enableNotify) {
   const tokens = getJwtTokens();
   if (tokens == null) {
     starCruiseNotify('金鑰不存在 ‼️', '請重新登入');
     return null;
   }

   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: `https://backend-prd.b2m.stardreamcruises.com/customers/cabin-allotment?itinerary_name=${itineraryName}&departure_date=${departureDate}&departure_port=${portNum}&pax=${persons}&lang=hant&currentStep=0&page=1`,
       headers: {
         'authorization': `Bearer ${tokens.accessToken}`,
       }
     };

     $httpClient.get(requestUrl, function(error, response, body) {
       if (error) {
         starCruiseNotify('查房失敗 ‼️', '連線錯誤');
         resolve(null);

       } else {
         if (response.status === 200) {
           try {
             const jsonData = JSON.parse(body);
             if (!jsonData.items || jsonData.items.length == 0) {
               resolve([]);
               return;
             }

             if (enableNotify != 0) { // enable notify.

               let notifyCabins = [];
               if (enableNotify == 1) {
                 notifyCabins = [cabinName_Balcony];
               } else {
                 notifyCabins = [cabinName_Balcony, cabinName_Oceanview, cabinName_Interior];
               }

               const targets = jsonData.items.filter(
                 item => notifyCabins.includes(item.cabin_name)
               );

               if (targets.length > 0) {
                 const output = targets
                   .map(item => `(${item.cabin_fare}P) ${getDateDay(item.departure_date)} ${item.traditional_chinese_cabin_name}`)
                   .join("\n");

                 notifyFoundCabin(output);
                 console.log(output);
               }
             }

             const cabins = jsonData.items.map(item => `(${item.cabin_fare}P) ${item.traditional_chinese_cabin_name}`);
             resolve(cabins);

           } catch (e) {
             starCruiseNotify('查房失敗 ‼️', String(e));
             resolve(null);
           }
         } else if (response.status === 401) {
           refreshJwtTokens().catch(reject);
           return;

         } else {
           starCruiseNotify('Cookie 已過期 ‼️', `(${response.status})請重新登入`);
           resolve(null);
         }
       }
     });
   });
 }

 function urlencode(str) {
   return encodeURIComponent(str).replace(/%20/g, '+');
 }

 function getShortItinerary(text) {
   const parts = text.split(' - ');
   if (parts.length >= 3) {
     const days = parts[1];
     const destination = parts.slice(2).join('-').replace('海上遊', '');
     return `(${days}) ${destination}`;
   }
 }

 function getDateDay(dateStr) {
   const date = new Date(dateStr);
   const days = ["日", "一", "二", "三", "四", "五", "六"];

   // Display date without year.
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');

   return `${month}/${day} (${days[date.getDay()]})`;
 }

 function getDateDayValue(dateStr) {
   const date = new Date(dateStr);
   const days = ["日", "一", "二", "三", "四", "五", "六"];

   // Display date without year.
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');

   return `${days[date.getDay()]}`;
 }

 function getDateYearMonth(dateStr) {
   const date = new Date(dateStr);
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份從 0 開始，所以要 +1

   return `📌 ${year} 年 ${month} 月`;
 }

 function getCabinInfos(cabins) {
   if (Array.isArray(cabins) && cabins.length > 0) {
     return '       ⮑' + cabins.join(' ');
   }

   return '';
 }

 function getCurrentDateTime() {
   const now = new Date();

   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, '0');
   const day = String(now.getDate()).padStart(2, '0');

   const hours = String(now.getHours()).padStart(2, '0');
   const minutes = String(now.getMinutes()).padStart(2, '0');
   const seconds = String(now.getSeconds()).padStart(2, '0');

   return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
 }

 function randomDelay(maxMs = 3000) {
   return new Promise(r => setTimeout(r, Math.random() * maxMs))
 }

 class RetryError extends Error {
   constructor(message) {
     super(message);
     this.name = "RetryError";
   }
 }

 function sleep(ms) {
   return new Promise(r => setTimeout(r, ms));
 }

 async function executeWithRetry(maxRetry = 1) {
   for (let attempt = 0; attempt <= maxRetry; attempt++) {
     console.log(`[Attempt ${attempt+1}/${maxRetry+1}] start`);

     try {
       await execute();
       return;
     } catch (e) {
       if (e && e.name === "RetryError" && attempt < maxRetry) {
         console.log(`[Retry] ${e.message} -> rerun execute()`);
         await sleep(800);
         continue;
       }
       throw e;
     }
   }
 }


 async function execute() {
   const maxMessageCount = 8;

   await new Promise(r => setTimeout(r, Math.random() * 30000))

   const portNum = String($persistentStore.read(PORT_KEY) || "12");
   const persons = parseInt($persistentStore.read(PAX_KEY) || "3", 10);
   const checkDayStr = $persistentStore.read(CHECK_DAY_KEY) || "五";
   const skipDateStr = $persistentStore.read(SKIP_DATE_KEY) || "";
   let enableNotify = parseInt($persistentStore.read(ENABLE_NOTIFY_KEY) || "0", 10);

   let checkDays = ["一", "二", "三", "四", "五", "六", "日"]
   if (checkDayStr != null && typeof checkDayStr === "string") {
     checkDays = checkDayStr.split("");
   }
   
   let skipDates = []
   if (skipDateStr != null && typeof skipDateStr === "string") {
     skipDates = skipDateStr.split(",");
   }

   if (Number.isNaN(enableNotify)) {
     enableNotify = 0;
   }

   const customerInfo = await getCustomerInfo();
   if (customerInfo == null || customerInfo === '') {
     starCruiseNotify('旅客資訊錯誤', `沒有資料`);
     return;
   }

   await randomDelay();
   const portDictionary = await getPortInfos();
   if (portDictionary == null) {
     starCruiseNotify('港口資訊錯誤', `沒有資料`);
     return;
   }

   if (!portDictionary.hasOwnProperty(portNum)) {
     starCruiseNotify('港口編號錯誤', `未知港口編號 ${portNum}`);
     return;
   }

   await randomDelay();
   const departureDates = await getDepartureDates(portNum);
   if (departureDates == null || departureDates.length == 0) {
     starCruiseNotify('出發日查詢', '沒有資料');
     return;
   }

   let messages = [];
   let lastGroupYearMonth = "";
   for (let i = 0; i < departureDates.length; i++) {
     const date = departureDates[i];

     const dateDay = getDateDayValue(date);
     if (!checkDays.includes(dateDay)) {
       continue;
     }
	 
	 if (skipDates.includes(date)) {
		 continue;
	 }

     await randomDelay();
     const itinerary = await getItinerary(portNum, date);
     if (itinerary == null) {
       starCruiseNotify('getItinerary查詢', '沒有資料');
       return;
     }

     await randomDelay();
     const cabins = await checkCabin(portNum, date, urlencode(itinerary), persons, enableNotify);
     if (cabins == null) {
       starCruiseNotify('房間查詢', '沒有資料');
       return;
     }

     const shortItinerary = getShortItinerary(itinerary);
     const cabinInfo = getCabinInfos(cabins);

     const yearMonth = getDateYearMonth(date);
     if (lastGroupYearMonth !== yearMonth) {
       if (lastGroupYearMonth != "") {
         messages.push('\n');
       }

       messages.push(yearMonth);
       lastGroupYearMonth = yearMonth;
     }

     const cabinStatusSymbol = cabins.length > 0 ? "✅" : "❌";
     let result = `${cabinStatusSymbol} ${getDateDay(date)} ${shortItinerary}`;
     messages.push(result);

     if (cabinInfo !== '') {
       messages.push(cabinInfo);
     }
   }

   // 一次顯示全部資訊
   const msg = '🌟 [Star Cruises] 探索星號 🚢\n' +
     `${customerInfo}\n` +
     `查詢時間：${getCurrentDateTime()}\n` +
     `出發地：${portDictionary[portNum]} ｜ 人數：${persons} 人\n` +
     '\n' +
     `${messages.join('\n')}`;

   if (enableNotify == 0) {
     quickDisplay(msg);
   } else {
     console.log(`${msg}`);
   }
 }

 executeWithRetry(1)
   .then(() => $done())
   .catch(e => {
     const safe = {
       name: e && e.name,
       message: e && e.message,
       stack: e && e.stack,
       raw: e
     };
     console.log(`執行錯誤: ${JSON.stringify(safe)}`);
     $done();
   });