/*
  exp1_task.js
  
  Exp 1: 2 alternative forced choice task, "Which is more associated with <Emotion>?"
  Two scatterplots side by side; the same color pair and dot count, differing only in which
  color is on top. Participants select one with the left/right arrow key.

  Session flow:
    1. device check        blocks phones/tablets
    2. welcome             "Begin Experiment"
    3. preload             stimulus images + Ishihara plates
    4. fullscreen          enters full screen (the fullscreen guard starts)
    5. window-size check   window must be at least MIN_W x MIN_H (asks to enlarge if not)
    6. consent             IRB approved consent form, "I consent" box, "Start Experiment"
    7. demographics        age, gender, race/ethnicity, languages; "Done"
    8. instructions        example trial image + how to answer
    9. 5 sections, one per emotion, in random order. 
       Each section: intro -> block 1 (cycles 1-2) -> half-way break -> block 2 (cycles 3-4) -> break
   10. Ishihara            intro + 11 plates (plate 0 first, the rest in random order)
   11. color vision Qs     3 questions; "Done"
   12. exit fullscreen     its data row is the session summary (one row per participant)
                           Then DataPipe saves the data to Zenodo, and the debrief is shown 
                           (no button, the participant just closes the window)

  Break pages continue with the spacebar, every other page continues with a mouse-click button (continue/done).

  Terms used for the trial order (within one emotion section, 64 trials):
    unique trial : one color pair x one dot count (8 pairs x 2 counts = 16)
    cycle        : all 16 unique trials once, randomized; in each cycle, 8 of the 16 unique trials 
                   show the stronger-color-on-top image on the left, the other 8 show it on the right.
    block        : contains 2 cycles = 32 trials; the second cycle shows every trial with the left/right
                   sides flipped, so each block shows each unique trial once on each side
    section      : contains 2 blocks = 64 trials, with a break after each block
  
  The same color pair is never shown twice in a row (also across cycle and block edges).

  One trial = choice screen (ends with the first arrow press) + blank screen
*/

// Stop with a message if the conditions file didn't load
if (!window.STIM_SETTINGS) {
  document.body.innerHTML = "<p style='font:16px sans-serif;margin:40px'>Could not load " +
    "<b>stimuli/exp1_conditions.js</b>. Run 1_stimuli/run_all.py, and check that the " +
    "<b>stimuli</b> folder is inside the same folder as index.html.</p>";
  throw new Error("stimuli/exp1_conditions.js not found");
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const S = window.STIM_SETTINGS;          // from stimuli/exp1_conditions.js (made by 1_stimuli/make_stimuli.py)
const IMG_DIR = "stimuli/" + S.image_folder;
const IMG_W = S.stim_width_px;           // images are always shown at exactly this width
const GAP = S.trial_gap_px;              // fixed space between the two images
const ISHIHARA_DIR = "ishihara/";        // ishihara-0.png ... ishihara-10.png (copied from the lab)
const BLANK_MS = 500;                    // blank screen between trials
const MIN_W = 2 * IMG_W + GAP + 80;      // smallest window width that fits a trial
const MIN_H = IMG_W + 210;               // smallest window height that fits a trial
const EXPERIMENT_VERSION = "exp1_v1";    // change whenever the exp version changes (e.g., test, v1, v2 etc.)
const DATAPIPE_ID = "Et4qeI8jkt51";      // DataPipe experiment ID (empty = don't save)

const KEYS_TEXT = "Press the left arrow for the left chart, or the right arrow for the right chart.";

// Last page the participant sees, DataPipe shows it after the data is saved
const DEBRIEF_HTML = '<div class="text-page"><p>Great job! You have finished the experiment.</p>' + 
      "<p>The goal of this experiment is to study how color and spatial structure influence the associations between emotions and data visualizations. This work will help understand factors influencing the meaning people infer from what they see, and will help with choosing colors that align with a designer's communicative intent.</p>" +
      "<p>Credit for your participation will appear on SONA in the next few days.</p>" +
      "<p>Thank you for participating! You may now close this window.</p></div>";

// DataPipe extension: saves the data to Zenodo
//  - Data is sent once when the timeline ends (stream: false), so only finished sessions are saved
//  - It then shows the debrief
const jsPsych = initJsPsych({
  extensions: [
    {
      type: jsPsychExtensionPipe,
      params: {
        experiment_id: DATAPIPE_ID,
        stream: false,
        filename: () => `${EXPERIMENT_VERSION}_${SUBJECT_ID}.csv`,
        data_string: () => jsPsych.data.get().ignore(["stimulus", "trial_type"]).csv(),
        wait_message: '<div class="text-page"><p>Saving your data. Please do not close this page.</p></div>',
        done_message: DEBRIEF_HTML,
        on_save: result => { if (!result.ok) jsPsych.getDisplayElement().innerHTML =
          '<div class="text-page"><p>Your data could not be saved. Please contact the researcher (akumble@wisc.edu) and mention this code: <b>' + SUBJECT_ID + '</b>.</p></div>'; },
        }
      }
    ],
});

// Buttons work only with a mouse click, so a key press cannot skip a page by accident
// (Arrow keys on trials are not affected)
["keydown", "keyup"].forEach(type => document.addEventListener(type, e => {
  if ((e.key === " " || e.key === "Enter") && e.target.tagName === "BUTTON") e.preventDefault();
}, true));

// Fullscreen guard: browsers don't let a page block Escape, so if a participant leaves
// fullscreen during the task, cover the screen and pause until they go back in
// (Closing the browser still works as normal)
let fullscreenRequired = false;  // true between entering and leaving fullscreen
const fsOverlay = document.createElement("div");
fsOverlay.style.cssText = 
  "position:fixed; inset:0; z-index:1000; display:none; align-items:center; " +
  "justify-content:center; flex-direction:column; background:rgb(128,128,128); " +
  "font-family:'Open Sans',Arial,sans-serif; font-size:18px; text-align:center;";
fsOverlay.innerHTML = 
  "<p>Please return to full screen mode to continue the experiment.</p>" +
  "<button class='jspsych-btn' type='button'>Return to full screen</button>";
fsOverlay.querySelector("button").addEventListener("click", () => document.documentElement.requestFullscreen());
document.body.appendChild(fsOverlay);

document.addEventListener("fullscreenchange", () => {
  if (!fsOverlay.isConnected) document.body.appendChild(fsOverlay);   // re-attach if jsPsych removed it
  const out = fullscreenRequired && !document.fullscreenElement;
  fsOverlay.style.display = out ? "flex" : "none";
});

// while the message is showing, ignore every key press (so no trial can be answered)
window.addEventListener("keydown", e => {
  if (fsOverlay.style.display === "flex") { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);

// ---------------------------------------------------------------------------
// Participant info: added as columns to EVERY data row
// ---------------------------------------------------------------------------
const SUBJECT_ID = jsPsych.randomization.randomID(10);            // also the data file name
const EMOTION_ORDER = jsPsych.randomization.shuffle(S.emotions);  // random for each participant
const START_TIME = new Date().toISOString();                      // saved once, on the summary row

jsPsych.data.addProperties({
  subject_id: SUBJECT_ID,
  sona_id: jsPsych.data.getURLVariable("id") || "none",          // SONA adds ?id=... to the link
  experiment_version: EXPERIMENT_VERSION,
});

// ---------------------------------------------------------------------------
// Trial order
// ---------------------------------------------------------------------------
/* Shuffle until check(order) is true */
function shuffleUntil(items, check) {
  for (let i = 0; i < 100000; i++) {
    const order = jsPsych.randomization.shuffle(items);
    if (check(order)) return order;
  }
  throw new Error("could not find a valid order");
}

/* Random sides for n unique trials: half get the stronger-on-top image on the left */
function randomSides(n) {
  return jsPsych.randomization.shuffle([...Array(n / 2).fill("left"), ...Array(n / 2).fill("right")]);
}
const flip = side => (side === "left" ? "right" : "left");

/* All trials for one emotion section, in the order they will be shown */
function buildSectionTrials(emotion, section) {
  const units = window.STIM_TRIALS.filter(t => t.emotion === emotion);   // 16 unique trials
  const sidesB1 = randomSides(units.length);                             // block 1 sides
  const sidesB2 = randomSides(units.length);                             // block 2 sides

  // cycle -> [block, side of each unique trial]; the 2nd cycle of a block flips the sides
  const cycles = [[1, sidesB1], [1, sidesB1.map(flip)], [2, sidesB2], [2, sidesB2.map(flip)]];

  const out = [];
  let prevPair = null;
  cycles.forEach(([block, sides], c) => {
    const items = units.map((t, i) => ({ t, side: sides[i] }));
    // shuffle; no color pair twice in a row, including the previous cycle's last trial
    let order = shuffleUntil(items, o =>
      o[0].t.pair_id !== prevPair && o.every((x, k) => k === 0 || x.t.pair_id !== o[k - 1].t.pair_id));
    prevPair = order[order.length - 1].t.pair_id;

    order.forEach(({ t, side }, k) => {
      const left = side === "left" ? t.img_occluding_strong : t.img_occluded_strong;
      const right = side === "left" ? t.img_occluded_strong : t.img_occluding_strong;
      out.push({
        left_img: left, right_img: right, emotion: emotion, block: block,

        // saving each trial's design columns:
        data: {                           // saved with the choice row
          part: "choice",
          emotion: emotion,               // which emotion
          emotion_position: section,      // when the emotion was shown (1-5)
          colorpair_id: t.pair_id,        // color pair ID (e.g., "happy_low1")          
          assoc_diff: t.x,                // association diff (x), continuous
          assoc_diff_level: t.condition,  // association diff level (low/high), categorical
          dotcount_top: t.n_occluding,    // number of occluding dots i.e., dots of the top color (30 or 70)
          presentation: c + 1,            // which of this trial's 4 showings (1-4) -> 1,2 = 1st half, 3,4 = 2nd half
          strong_hex: t.strong_hex,       // hex code for the stronger color
          weak_hex: t.weak_hex,           // hex code for the weaker color
          strong_top_side: side,          // which side has the stronger color on top (left/right)
        },
      });
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------
/* HTML for one trial: question, emotion, key instructions, then the two images
   showImages = false keeps the same layout but hides the images (used for the blank between trials) */
function trialHTML(leftImg, rightImg, emotion, showImages = true) {
  const hide = showImages ? "" : ' style="visibility:hidden"';
  return `
    <div class="trial" style="width:${2 * IMG_W + GAP}px">
      <p class="trial-lead">Which is more associated with</p>
      <p class="trial-emotion">${emotion} ?</p>
      <p class="trial-keys">${KEYS_TEXT}</p>
      <div class="trial-images" style="gap:${GAP}px">
        <img src="${IMG_DIR + leftImg}" width="${IMG_W}" height="${IMG_W}" alt=""${hide}>
        <img src="${IMG_DIR + rightImg}" width="${IMG_W}" height="${IMG_W}" alt=""${hide}>
      </div>
    </div>`;
}

/* A text page with one button (default "Continue") */
function buttonPage(html, part, label = "Continue") {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="text-page">${html}</div>`,
    choices: [label],
    data: { part: part },
  };
}

/* A text page that continues with the spacebar (used for the breaks) */
function spacePage(html, part) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="text-page">${html}<p>Please press the spacebar when you are ready to continue.</p></div>`,
    choices: [" "],                      // " " is the spacebar
    data: { part: part },
  };
}

// ---------------------------------------------------------------------------
// 1-8. Start of the session
// ---------------------------------------------------------------------------
// 1. device check: no phones or tablets
const deviceCheck = {
  type: jsPsychBrowserCheck,
  skip_features: ["webcam", "microphone", "vsync_rate"],
  inclusion_function: data => data.mobile === false,
  exclusion_message: () => "<p>This study needs a laptop or desktop computer with a keyboard. " +
                           "Please return to it on a computer. You may now close this window.</p>",
  data: { part: "device_check" },
};

// 2. welcome
const welcome = buttonPage(
  "Welcome to our experiment!" +
  '<p>At the bottom of this screen, you will see a button that says "Begin Experiment".' +
  "<br>Please only click that button when you are ready to complete the 30 minute experiment in one sitting.</p>" +
  "<p>Once you click that button, it will not be possible to restart the experiment.</p>",
  "welcome", "Begin Experiment");

// 3. preload: mock trial image + all stimulus images + the 11 Ishihara plates
const preload = {
  type: jsPsychPreload,
  images: [
    "mock_trial.png",
    ...window.STIM_TRIALS.flatMap(t => [IMG_DIR + t.img_occluding_strong, IMG_DIR + t.img_occluded_strong]),
    ...Array.from({ length: 11 }, (_, i) => `${ISHIHARA_DIR}ishihara-${i}.png`),
  ],
  data: { part: "preload" },
};

// 4. fullscreen
const enterFullscreen = {
  type: jsPsychFullscreen,
  fullscreen_mode: true,
  button_label: "Continue",
  on_finish: () => { fullscreenRequired = true; },      // guard on
  data: { part: "fullscreen_on" },
};

// 5. window-size check (also records screen/window size, browser and OS)
const sizeCheck = {
  type: jsPsychBrowserCheck,
  skip_features: ["webcam", "microphone", "vsync_rate"],
  minimum_width: MIN_W,
  minimum_height: MIN_H,
  exclusion_message: () => "<p>Your screen is too small for this study. " +
                           "Please return to it on a larger screen. You may now close this window.</p>",
  data: { part: "size_check" },
};

// 6. consent
const consent = {
  type: jsPsychSurveyMultiSelect,
  questions: [{
    prompt: 
      " <div class='consent-text'>" +
      " <strong>UNIVERSITY OF WISCONSIN-MADISON</strong>" +
      " <br><strong>Research Participant Information and Consent Form</strong>" +
      " <br><br><strong>Title of the Study:</strong> Investigating how observers perceive, interpret, and evaluate visual features in 2D scenes and 3D environments" +
      " <br><br><strong>Principal Investigator:</strong> Karen B. Schloss (phone: 608-316-4495) (email: kschloss@wisc.edu)" +
      " <br><br><strong><u>DESCRIPTION OF THE RESEARCH</u></strong>" +
      " <br>You are invited to participate in a research study about how visual features influence the ability to perceive, interpret, navigate, and remember information in visual displays." +
      " <br><br>You have been asked to participate because you saw a description of the study and signed up to be a participant." +
      " <br><br>The purpose of the research is to understand principles by which people perceive, evaluate and interpret visual information (e.g., the meaning of parts of a scientific diagram)." +
      " <br><br>This study will include adults from UW-Madison and nearby areas who volunteer to participate." +
      " <br><br>The research will be conducted online, with no requirement to appear in person." +
      " <br><br><strong><u>WHAT WILL MY PARTICIPATION INVOLVE?</u></strong>" +
      " <br>If you decide to participate in this research you will be presented with visual displays containing images and/or text and will be asked to make judgments about them. For example, you may see shapes and be asked how round they appear or view a graph with a legend and interpret information about the data in the graph." +
      " <br><br>You will be asked to respond by making button presses on a keyboard/mouse. You may be asked to complete questionnaires about your expertise or educational level in a given domain (e.g., neuroscience) and questionnaires about what sorts of things you like/dislike. Finally, you may be asked to respond to questions about your experience during the experiment (e.g., how much you enjoyed the task)." +
      " <br><br>You will be asked to complete 2-6 surveys or tasks." +
      " <br><br>Your participation will last approximately 30-60 minutes per session (as specified when you signed up to participate) and will require 1 session (30 to 60 min total)." +
      " <br><br><strong><u>ARE THERE ANY RISKS TO ME?</u></strong>" +
      " <br>We don't anticipate any risks to you from participating in this study." +
      " <br><br><strong><u>ARE THERE ANY BENEFITS TO ME?</u></strong>" +
      " <br>There are no direct benefits for participating in this study." +
      " <br><br><strong><u>WILL I BE COMPENSATED FOR MY PARTICIPATION?</u></strong>" +
      " <br>Consistent with PSY 202/210/225 policies, you will receive 1 extra credit point/30 minutes of study participation. At the end of the semester, those extra credit points are converted such that 1 point of extra credit = 0.33% added directly to your grade at the end of term. Consult your class syllabus for additional details regarding the application of extra credit points to your final grade." +
      " <br><br><strong><u>HOW WILL MY CONFIDENTIALITY BE PROTECTED?</u></strong>" +
      " <br>While there will probably be publications as a result of this study, your name will not be used. Typically, group characteristics will be published, but datasets with individual responses may also be shared. In such cases, the data will not be linked to your name or other identifiable information." +
      " <br><br><strong><u>WHOM SHOULD I CONTACT IF I HAVE QUESTIONS?</u></strong>" +
      " <br>You may ask any questions about the research at any time. If you have questions about the research you can contact the Principal Investigator Karen B. Schloss at 608-316-4495." +
      " <br><br>If you are not satisfied with response of research team, have more questions, or want to talk with someone about your rights as a research participant, you should contact the Education and Social/Behavioral Science IRB Office at 608-263-2320." +
      " <br><br>Your participation is completely voluntary. If you decide not to participate or to withdraw from the study you may do so without penalty." +
      " <br><br>By clicking the box below, you confirm that you have read this consent form, had an opportunity to ask any questions about your participation in this research and voluntarily consent to participate. You may print a copy of this form for your records." +
      " <br><br>Please click the box below next to the text 'I consent' to give your informed consent to participate." +
      " </div>",
    options: ["<strong>I consent</strong>"],
    horizontal: false,
    required: true,
    name: "Consent",
  }],
  button_label: "Start Experiment",
  data: { part: "consent" },
};

// 7. demographics
const demographics = {
  type: jsPsychSurveyText,
  questions: [
    { prompt: "Age", name: "Age", rows: 1, columns: 3, required: true },
    { prompt: "Gender", name: "Gender", rows: 1, columns: 15, required: true },
    { prompt: "Race/ethnicity", name: "Race/ethnicity", rows: 1, columns: 30, required: true },
    { prompt: "List all languages you know", name: "Languages", rows: 6, columns: 60, required: true },
  ],
  preamble: "Please answer the following questions.",
  button_label: "Done",
  data: { part: "demographics" },
};

// 8. instructions
const instructions = buttonPage(
  `<div class="instructions-page">
     <h2>Instructions</h2>

     <p>In this experiment, you will be presented with <b>pairs of charts</b>, one on the left
        and one on the right, displayed side-by-side like below. Above the charts, there will be a prompt asking which chart is more associated with a given emotion. In the example image below, the word "emotion" is used as a placeholder. During the actual experiment, you will be asked to evaluate pairs of charts for a total of 5 emotions: happy, sad, angry, fearful, disgust.</p>

        <img src="mock_trial.png" style="width:750px; display:block; 
        margin:12px auto; border:1px solid #000;" alt="Example trial">

     <p>On each trial, your task is to select the chart that you think is more associated with the given emotion.</p>

     <p>To select a chart, please use the arrow keys on your keyboard. Press the <b>left arrow</b>
        key to select the left chart, or the <b>right arrow</b> key to select the right chart.</p>

     <p>In the experiment, you will be asked to evaluate all the charts for a given emotion before 
        moving on to the next emotion. You will receive a break when you have completed half of the trials for a given emotion, and another break when you have completed all the trials for that emotion.</p>

     <p>Total time for the experiment is approximately <b>30 minutes</b>. Please click <b>"Continue"</b>
        to begin the experiment task!</p>
   </div>`,
  "instructions");

// ---------------------------------------------------------------------------
// 9. Emotion sections
// ---------------------------------------------------------------------------
let trialCounter = 0;                    // counts choice trials across the whole session

function emotionSection(emotion, section) {
  const intro = spacePage(
    `<p>In this section, you will be asked to select which chart is more associated with</p>
     <p style="font-size:150%; font-weight:bold">${emotion}</p>`, "section_intro");

  const choice = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => trialHTML(jsPsych.evaluateTimelineVariable("left_img"),
                              jsPsych.evaluateTimelineVariable("right_img"),
                              jsPsych.evaluateTimelineVariable("emotion")),
    choices: ["ArrowLeft", "ArrowRight"],
    data: jsPsych.timelineVariable("data"),   // the trial's design columns (see buildSectionTrials)
    on_finish: function (data) {
      trialCounter += 1;

      // saving each trial's response columns:

      // 1. position in the whole session (1-320)
      data.trial_overall = trialCounter;

      // 2. side bias check (left / right)
      data.chosen_side = jsPsych.pluginAPI.compareKeys(data.response, "ArrowLeft") ? "left" : "right";

      // 3. main outcome: 1 if the chosen side has the stronger color on top, 0 otherwise
      data.chose_strong_top = data.chosen_side === data.strong_top_side ? 1 : 0;
    },
  };

  const blank = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => trialHTML(jsPsych.evaluateTimelineVariable("left_img"),
                              jsPsych.evaluateTimelineVariable("right_img"),
                              jsPsych.evaluateTimelineVariable("emotion"),
                              false),         // same screen but images hidden
    choices: "NO_KEYS",
    trial_duration: BLANK_MS,
    data: { part: "blank" },
  };

  const all = buildSectionTrials(emotion, section);
  const block = b => ({ timeline: [choice, blank], timeline_variables: all.filter(v => v.block === b) });

  const halfway = spacePage(
    "<p>Great job! You have completed half of the trials for this emotion.</p>", "break_half");

  const pages = [intro, block(1), halfway, block(2)];
  if (section < EMOTION_ORDER.length) {      // after the last section, the Ishihara intro follows
    pages.push(spacePage(
      `<p>Great job! You have completed ${section} out of ${EMOTION_ORDER.length} emotions.</p>`, "break_section"));
  }
  return pages;
}

// ---------------------------------------------------------------------------
// 10-12. End of the session
// ---------------------------------------------------------------------------
// 10. Ishihara: intro, then 11 plates (plate 0 first, the rest in random order)
const ishiharaIntro = buttonPage(
  `<p>Great job! You have finished all ${EMOTION_ORDER.length} emotions.</p>
   <p>Next, you will see an image on the screen. If you see a number in the image, please carefully
      type that number in the box. If you do not see a number in the image, please type 'None' in the box.
      This part of the experiment will take about 2 minutes.</p>`, "ishihara_intro");

const ISHIHARA_ANSWERS = ["12", "8", "5", "29", "74", "7", "45", "2", "16", "35", "96"];   // plate 0-10

const ishiharaPlates = [0, ...jsPsych.randomization.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])].map(plate => ({
  type: jsPsychSurveyHtmlForm,
  preamble: '<div><p style="font-size:25px">Carefully type what number you see using digits ' +
    '(e.g., if you see 100, type "100" not "one hundred").<br>If you do not see a number, type "None".<br></p></div>' +
    `<div><img src="${ISHIHARA_DIR}ishihara-${plate}.png" alt="Ishihara Plate" style="height:500px"></div>`,
  
  // required: can't continue with an empty box
  // pattern: digits only, or "None" (any capitalization)
  // spaces around the answer are allowed
  // The browser shows the title text if the answer isn't valid
  html: '<div><p><input name="number" type="text" required autocomplete="off" ' +
        'pattern="\\s*([0-9]+|[Nn][Oo][Nn][Ee])\\s*" ' +
        'title="Please type the number using digits only (e.g., 12), or type None." autofocus /></p></div>',
  
  on_load: () => document.querySelector('input[name="number"]')?.focus(),
  post_trial_gap: 250,
  data: { part: "ishihara", ishihara_plate: plate, correct_response: ISHIHARA_ANSWERS[plate] },
}));

// 11. color vision questions
const colorVision = {
  type: jsPsychSurveyMultiChoice,
  questions: [
    { prompt: "Do you have difficulty seeing colors or noticing differences<br>between colors compared to the average person?",
      options: ["Yes", "No"], horizontal: false, required: true, name: "colorDifficulty" },
    { prompt: "Do you consider yourself to be colorblind?",
      options: ["Yes", "No"], horizontal: false, required: true, name: "colorBlind" },
    { prompt: "What device did you use to complete this experiment?",
      options: ["Computer", "Tablet", "Phone", "Other"], horizontal: false, required: true, name: "device" },
  ],
  button_label: "Done",
  data: { part: "color_vision" },
};

// 12. exit fullscreen
const exitFullscreen = {
  type: jsPsychFullscreen,
  fullscreen_mode: false,
  on_start: () => { fullscreenRequired = false; },      // guard off before leaving fullscreen

  data: {
    part: "session_summary",
    start_time: START_TIME,
    // stimulus settings (from config.py), a record of which stimulus set this data came from
    stim_width_px: S.stim_width_px, trial_gap_px: S.trial_gap_px, dot_px: S.dot_px,
    coverage: S.coverage, areas: S.areas.join(","), occluded_n: S.occluded_n, jnd_mult: S.jnd_mult,
  },

  on_finish: data => {
    data.end_time = new Date().toISOString();
    // jsPsych logs fullscreen exits and tab switches separately, so im summarizing them here
    // only count the events before this screen
    const log = jsPsych.data.getInteractionData().values().filter(e => e.trial < data.trial_index);
    const exits = log.filter(e => e.event === "fullscreenexit");
    const blurs = log.filter(e => e.event === "blur");
    data.n_fullscreen_exits = exits.length;
    data.fullscreen_exit_trials = exits.map(e => e.trial).join(";");   // trial_index of each exit
    data.n_tab_switches = blurs.length;
    data.tab_switch_trials = blurs.map(e => e.trial).join(";");        // trial_index of each tab switch
  },
};

// ---------------------------------------------------------------------------
// Build the timeline and run
// ---------------------------------------------------------------------------
const timeline = [deviceCheck, welcome, preload, enterFullscreen, 
                  sizeCheck, consent, demographics, instructions];
EMOTION_ORDER.forEach((emotion, i) => timeline.push(...emotionSection(emotion, i + 1)));
timeline.push(ishiharaIntro, ...ishiharaPlates, colorVision);
timeline.push(exitFullscreen);
jsPsych.run(timeline);