// A bot to attend my online classes on Acharya Live platform(Big Blue Button)


// Your AUID
const AUID = 'auid';
// Your password
const password = 'password';
/* Want the bot to open chrome ?
   when 'true': the bot will open chrome and you can see all the operations
   when 'false': the bot will perform all the operations without opening chrome
   the bot will attend the class in both the scenarios. */
const chormeOpen = true; 


/**************************************
  WARNING!!!
  DO NOT CHANGE ANY CODE BELOW 
  (Unless you know what you're doing)
**************************************/

// start time for each class in a day
const time = [
  {sTime: '09:00', eTime: '09:50'},
  {sTime: '10:00', eTime: '10:50'},
  {sTime: '11:10', eTime: '12:00'},
  {sTime: '12:10', eTime: '13:00'},
  {sTime: '13:40', eTime: '14:30'},
  {sTime: '14:40', eTime: '15:30'},
  {sTime: '15:40', eTime: '16:30'},
];

let isClassRunning = false;

const puppeteer = require('puppeteer');
const schedule = require('node-schedule');

const scheduler = scheduleBot();
// console.log(scheduler);
const firstClass = scheduler[0].sTime;
console.log(`bot will start at ${firstClass}`);
// scheduler for classes
scheduler.forEach(item => {
  const [ hours, minutes ] = item.sTime.split(':');
  // console.log(hours, minutes);
  const tempDate = new Date();
  const year = tempDate.getFullYear();
  const month = tempDate.getMonth();
  const date = tempDate.getDate();
  // console.log(`${year}, ${month}, ${date}`);
  const newDate = new Date(year, month, date, hours, minutes, 00);
  // console.log(newDate);
  // scheduling a job for every {hours, minutes} in time array
  const j = schedule.scheduleJob(newDate, async () => {
    await aliveBot();
  });
})

function scheduleBot() {
  const d = new Date();
  const h = ('0' + String(d.getHours())).slice(-2);
  const m = ('0' + String(d.getMinutes())).slice(-2);
  const currentTime = `${h}:${m}`;
  const [cHours, cMinutes] = currentTime.split(':');
  const newSMin = ('0' + String(Number(cMinutes) + 1)).slice(-2);


  const newTime =  time.filter(item => {
    const [sHours, sMinutes] = item.sTime.split(':');
    if(cHours >= sHours){
      if(currentTime < item.eTime) {
        return true;
      }
    }
    return item.sTime >= currentTime;
  });

  const firstClass = newTime[0];
  if(!firstClass) {
    console.log('no more classes for today')
    return [];
  }
  if(currentTime < firstClass.sTime) {
    return newTime
  }
  newTime[0].sTime = `${cHours}:${newSMin}`;
  return newTime;
}

// aliveBot();

async function aliveBot() {
  // if browser is already running then return
  if(isClassRunning) {
    console.log('class already going on...');
    return;
  };
  isClassRunning = true;

  // open browser
  const launchOptions = {
    headless: !chormeOpen,
    // executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    slowMo: 100,
    defaultViewport: null,
    args: ['--start-maximized']
  }
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  
  await page.goto('https://alive.university/');
  
  await page.type('input[name=user_email]', AUID);
  await page.type('input[name=user_password]', password);
  const signInButton = await page.$('button');
  signInButton.click();
  await page.waitForNavigation({waitUntil: ['networkidle0', 'domcontentloaded']})

  // attend class according to current time
  attendClass(page, browser);
  // end of alive bot
}

function attendClass(page, browser){
  console.log('running attend');
  page.reload({waitUntil: ['networkidle0', 'domcontentloaded'], timeout: 5000});

  page.on('response', async res => {
    if(res.url() !== 'https://api.alive.university/api/v1/getrooms') {
      return;
    }
    if(res.status() === '200') {
      return;
    }
    // console.log(res.url());

    // extract timetable for the current day
    const timeTable = (await res.json())['data'];
    // console.log(timeTable);
    const tempSub = getCurrentSubject(timeTable);
    // console.log(tempSub === '');
    const currentSubject = tempSub.subject_name_short;
    // close browser when there is no class(currentSubject === empty string)
    if(currentSubject === '') {
      console.log('there is no class');
      console.log('closing browser in 5 sec...');
      setTimeout(async () => {
        // console.log('closing...');
        isClassRunning = false
        await browser.close(); 
      }, 5000);
      return;
    }

    //find the card with current subject
    //find all subject's card
    const cards = await page.$$('.MuiPaper-root.MuiCard-root');
    cards.forEach(async (card) => {
      // extract subject name for each card and...
      let sub = await (await (await card.$('h2')).getProperty('textContent')).jsonValue();
      sub = sub.replace('Subject : ', '');
      // ...compare with currentSubject to get the current subject card
      if(sub !== currentSubject){
        return;
      }
      // find the join button in the card and click it
      const button = await card.$('button:last-child');
      button.click();

      // waiting for session to get started 
      try{
        // check if page is navigating or not and throw error after 5000ms ...
        await page.waitForNavigation({waitUntil: ['networkidle0', 'domcontentloaded'], timeout: 5000});
        const d = new Date();
        console.log(`\n\nstarting class ${currentSubject} at ${d.getHours()}:${d.getMinutes()}`);
        // ...then check every minute whether class is over
        const interval = setInterval(async () => {
          if(isClassOver(tempSub.eTime)) {
            const temp = new Date();
            console.log(`class over at ${temp.getHours()}:${temp.getMinutes()}`);
            console.log('closing browser...');
            console.log('waiting for next class...')
            clearInterval(interval);
            isClassRunning = false;
            await browser.close();
          }
        }, 60000);

      }catch(err) {
        // console.log('refreshing...')
        // if it comes in catch block means that the session is not started... reload the page and check again
        page.reload({waitUntil: ['networkidle0', 'domcontentloaded']});
      }

    })
  })
  // return;
}

function getCurrentSubject(timeTable) {
  // console.log('running get Current sub');
  let currentSubject = '';
  // get the current time
  const temptDate = new Date();
  let tempH = temptDate.getHours();
  tempH = ('0' + tempH).slice(-2);
  let tempM = temptDate.getMinutes();
  tempM = ('0' + tempM).slice(-2);
  let tempS = temptDate.getSeconds();
  tempS = ('0' + tempS).slice(-2);
  // format the current time
  const currentTime = `${tempH}:${tempM}:${tempS}`;
  // console.log(currentTime);
  // console.log(currentTime > '16:30:00');
  if(currentTime > '16:30:00') {
    return {subject_name_short: ''};
  }

  // select sub according to current time
  const temp = timeTable.every(sub => {
    let { sTime, eTime, subject_name_short } = sub;
    const regex = /\.0{7}/;
    sTime = sTime.replace(regex,'');
    eTime = eTime.replace(regex,'');

    if(currentTime >= sTime && currentTime <= eTime) {
      currentSubject = sub;
      return false;
    }
    return true;
  })
  // when no class return empty string...
  if(temp) {
    return {subject_name_short: ''};
  }
  // ...else return currentSubject
  return currentSubject;
}

function isClassOver(time) {
  time = time.replace(/\.0{7}/, '');
  // adding extra 5 mins to the end time
  let [tH, tM, tS] = time.split(':');
  tM = `0${Number(tM) + 5}`.slice(-2);
  // console.log(tH, tM, tS);
  time = `${tH}:${tM}:${tS}`;
  // console.log(time);
  // get the current time
  const temptDate = new Date();
  let tempH = temptDate.getHours();
  tempH = ('0' + tempH).slice(-2);
  let tempM = temptDate.getMinutes();
  tempM = ('0' + tempM).slice(-2);
  let tempS = temptDate.getSeconds();
  tempS = ('0' + tempS).slice(-2);
  // format the current time
  const currentTime = `${tempH}:${tempM}:${tempS}`;
  
  return currentTime > time;
}