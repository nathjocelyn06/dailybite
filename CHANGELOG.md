# Changelog

## v5.0 · 2026-11-23 — DailyBite is everyone's now
- **Sign in with your email.** One field, no password: the link in the email lets you in, and an address nobody has used before makes a new account. There is a six-digit code in the same email for when tapping a link is awkward.
- **Your records are yours.** Pages and server actions now run on the signed-in person's own Supabase session, so the row-level security written back in migration 0001 — `user_id = auth.uid()` on all fifteen tables, and per-folder rules on the photo bucket — is what separates one account from another, not just the filter in each service. Both are kept.
- **Claude, per account.** Settings shows your own connector URL. The shared `MCP_ACCESS_KEY` still works and still means the owner's account, so a connector set up before today keeps working.
- **Installable, and honest when offline.** The service worker now answers a failed page load with DailyBite's own offline page rather than the browser's error, which is also what a browser wants to see before it offers to install the app.
- Nothing was redesigned. The sign-in screen is the only new page.

## v4.28 · 2026-11-20 — A day you spent nothing on looks like it
- **Daily spend draws nothing where nothing was spent.** The grey stub that stood on every empty day is gone, and a whole period with no spending is an empty chart that says so, with the days still labelled underneath.
- Today is marked with a tick on the baseline instead of a tinted column, which used to make a day with no spending look like a spent one.

## v4.27 · 2026-11-19 — Magnets beside the door
- **Decorate your fridge opens in the empty third column**, under *Cook from my fridge*, instead of pushing everything down below the unit. The door is right next to it, so a magnet goes from the tray onto the door without scrolling. The panel keeps all its state in the fridge; it is only drawn through a portal into the slot the page leaves for it, and falls back to its old place if that slot is not there.

## v4.26 · 2026-11-19 — The waiting was geography
- **The app was running on the wrong side of the world.** Requests entered Vercel in Seoul and were then handed to a function in Virginia, which talked to a database back in Seoul — so every single query crossed the Pacific twice. `vercel.json` pins the functions to `icn1`, next to the database.
- **Fewer trips to make a page.** The time zone (read before anything else can start, on every page, action and MCP call) is held for a minute; the settings row is read once per request instead of three times; and reminders are re-derived at most every five minutes instead of on every page load — six round trips that used to sit in front of Home. The Notifications page still forces a fresh pass, because there the list is the point.
- **The journal is a book again, not a book on a pink mat.** The cover is a thin frame round the paper and the spread takes the full width and most of the window's height.

## v4.25 · 2026-11-19 — Phase 6: DailyBite draws itself inside Claude
- **Three MCP Apps views.** Ask Claude for your day, your fridge or a meal and it can now render the real thing — the calorie bar and macros, the shelves with their use-soon flags, the meal with its items — instead of a wall of JSON.
- **They do things.** Confirm a pending meal from the day view, use one of something from the fridge view (the shelf re-reads itself), confirm or delete from the meal view.
- **Nothing is lost where views are not supported.** Every tool still answers in words with its “Open in DailyBite” link; the view is extra.
- Built on SEP-1865 with the browser half of `@modelcontextprotocol/ext-apps` vendored and inlined, because its server half wants the v2 SDK and zod 4 and this app is on neither.

## v4.24 · 2026-11-19 — One red, a real week, and a tidier archive
- **Archive: no month rail, and every row can be deleted.** The results take the whole width, and the × on a row removes the original record — the meal, the expense, the journal page, the fridge entry, the saved recipe — behind a confirm that says so.
- **The weekly budget works as a week.** Switching to Weekly lands on the week you are actually in instead of the week the month starts in, and Daily spend draws all seven days (Mon–Sun, today banded, days with nothing as a flat line) with the daily figure that keeps you inside the week's share.
- **One red for charts: `#E72025`.** The calorie ring, the macro bars, the spend bar and the daily-spend chart all use it.
- **Today's Meal Plan is bright pink.**
- **The opening logo is nearly twice the size and sharp.** The splash was pointing at a 3072² file whose wordmark filled only a third of the width, declared at the wrong ratio — so it drew small and slightly squashed. It now uses a tight full-resolution crop at its own ratio.
- Settings is a solid cog, the sidebar has more air between the logo and the first item, and the water goal is gone from Settings.

## v4.23 · 2026-11-19 — Stickers on top
- Polaroids are what you stick things on, so stickers, post-its and text now sit above them whatever order they were added in. Each kind keeps its own stacking within its layer.

## v4.22 · 2026-11-19 — The camera does the typing, and reminders actually arrive
- **Receipt scan reads the whole receipt.** Store, date, time, every line with its quantity and price, subtotal, tax, discount, payment method and the total — all editable, all pre-filled. Then a preview of what is about to be filed, with **Confirm and save**, **Edit details** and **Retake photo**; the expense is dated by the receipt, not by the day you scanned it, and the small print is written into its note.
- **A receipt cannot be filed twice.** The same shop, day and amount opens the expense that is already there with a line saying so, instead of charging the budget again.
- **The journal camera stopped asking what you ate.** It recognises the food, estimates the nutrition, and leaves you the portion and the grams. No food name field, no food search.
- **Meal categories are a row of buttons**, not a dropdown: Breakfast, Lunch, Dinner, Snack, with the one your clock suggests marked "now" and the photo's own guess selected.
- **The same photo is one meal.** Saving a scan that was already saved opens the meal it made.
- **Alerts are real now.** Two of them, both about a number crossing a line you drew yourself: the day's calories going past your goal, and the month's food spend passing your threshold. A service worker (`public/sw.js`) shows them, `/api/reminders` decides from your own records, and the `notifications` table's dedupe key makes delivery exactly-once — once a day for calories, once a month for the budget, on any device — with each one landing in the in-app list too. Both switch on and off on **Notifications**, with a test button and a permission flow that explains a block. No meal or journal nagging on a timer.
- My progress: the overview card is a soft purple-to-white gradient.

## v4.21 · 2026-11-19 — A pastel My progress, and turning that holds still
- **My progress leads with a pastel card.** The AI overview is a lilac→sky gradient with ink text instead of the deep ocean block, and its mark is the My progress icon (the rising chart from `NavIcon`) on white, not a star. The period switch, the boxes and Refresh overview are reworked for a light ground.
- **A text box is a box.** The dashed rule under journal text is gone — nothing is printed on the page but what you write.
- Fixed: **turning an element jumped and jittered.** The angle was measured in mixed units (x in percent, y in pixels) around the element's top-left corner, so grabbing the dot snapped it to the pointer. It now measures real pixels around the element's own centre, against the angle it was grabbed at, so the artwork turns with your hand and comes back straight (a 3° snap at zero).
- **Stickers at full resolution.** All 13 are re-cut from the sheet at its own resolution (192–744 px, was a 320 px cap that blurred the small ones and softened the big ones).

## v4.20 · 2026-11-19 — Your sticker sheet, and a quieter journal
- **The stickers are yours now.** `Sticket Vector Asset.png` cut into 13 transparent PNGs in `public/stickers/` — ketchup, mayo, soy sauce, Berry Good, Fresh, Good Menu, the DailyBite mark, three stars and three flowers — by the same blob trace as the magnets, so each is trimmed to its own artwork. The emoji set is gone.
- **Add to the page only appears when you ask for it.** Edit Journal opens it as a panel with a **Close** on it; the journal opens clean, with just the day summary and the book.
- **+ Add meal sits in Day summary.** The button under the book is gone and so is the one in the header — there is one Add meal on the page now, and the row under the book is just Edit Journal.
- 🐛 A tall sticker spilled out of its swatch in the tray: the grid track sizes to the image, so a percentage height resolved against the image itself. Fixed with a definite size and `object-fit`.
- `PhotoDrop` is gone, unused since the photo tool was removed.

## v4.19 · 2026-11-18 — The tray comes out of the book
- 🐛 **You could not delete anything.** The × on a selected element sat inside the element, so its pointerdown started a drag and the browser dropped the click that followed. It stops the event now, and delete works on post-its, text, stickers and meal cards alike.
- 🐛 **Meals were getting two polaroids.** Effects run twice in development and the card is filed asynchronously, so the second pass saw the same empty page and filed again. A ref holds the meals already being placed, and duplicates already saved are cleared on load.
- **Add to the page is its own card**, between Day summary and the book: a text box, four post-its and the stickers. **Photo and Doodle are gone**, along with the tool modes they needed — dragging and drawing cannot both own a drag on the paper.
- **A long silver spine** runs down the fold with **half-circle rings** standing on it.
- The pink cover is brighter (`#F2B9C2 → #FBA3BE`), the buttons are the old yellow again, and the page title no longer prints on the paper.

## v4.18 · 2026-11-18 — A book lying open, and everything movable
- **Two facing pages, flat.** One sheet with the fold painted down the middle — warm paper, a soft curve into the gutter, the block of pages peeking out at the edges, and flat chrome rings lying along the fold. The two pages are a background rather than two containers, so the whole spread is one coordinate space and a polaroid can be dragged from the left page to the right without a special case.
- **Nothing waits for Edit Journal any more.** Meals, post-its, stickers and text can be picked up, resized and turned at any time; the button now only opens the tray for *adding* things and for drawing, which would otherwise fight with dragging.
- **Meals are cards on the page.** Each meal gets a `meal_card` element the first time its day is opened, which is what gives it a position of its own; the × on a card deletes the meal, as before.
- **Text is a box**, resized and rotated like a sticker, set in Headspace Medium — the one text style.
- Cover goes from brown to the pink gradient `#D8A6AD → #E098AC`, and the yellow buttons go pastel (`#FBE7A1`).
- A meal opened with `?edit=1` now shows its editor above the book, so Home's **Edit** on a pending estimate still lands somewhere.

## v4.17 · 2026-11-18 — Edit Journal changes a meal's photo
- **Change photo** now sits on each polaroid, appearing only while Edit Journal is on. Pick an image and it replaces that meal's photo: the file goes to a server action (the browser has had no Supabase client since v3.1), lands in the private bucket, and the meal row is pointed at the new path.
- The meals are rendered on the server and handed to the editor as a prop, so they cannot read its state. The button is revealed by `.journal-sheet.is-editing` in CSS instead of threading the flag through — no client wrapper around the whole list.
- `UpdateMealInput` takes `photo_path`, nullable, so a photo can be replaced or taken off entirely (this also reaches `update_meal` over MCP).

## v4.16 · 2026-11-18 — The journal is a ring binder on a dark ground
- **Full width.** Day summary moved above the journal, the side column is gone, and the binder is the page.
- **A white ring binder on `#441910`**, as in the reference: a brushed spine with a cap at each end and three chrome rings clamped over the paper — each ring's back half behind the sheet, its front half (and its shadow) over it. The yellow two-page book is gone.
- **The polaroid lost its buttons.** Delete is an × in the corner; a meal still waiting on you keeps a single *Confirm eaten*. Editing lives behind **Edit Journal**.
- **Daily review is gone**, and `ReviewForm` with it. A page title set earlier still shows; Claude can still write one through `write_journal_review`.

## v4.15 · 2026-11-18 — The journal is an open book
- **Two pages in a yellow cover**, joined by three drawn metal fittings down the gutter (`components/journal/Book.tsx`). The ring binder is gone, and so is the ruled-paper texture. Below 860px the spread folds into one page — a two-page book at 390px is unreadable.
- **Meals are polaroids on the left page**, caption and meta *inside* the frame: the note (or the meal name), then slot · place · kcal in small caps. Confirm / Edit / Delete sit under the photo.
- **Post-its, with a pin.** Four papers in the toolbar; tap one and it lands on the page with a domed pin at its top edge. Type straight into it, drag, resize, rotate, remove. A post-it is a `text` element carrying `data.postit` and its paper colour, so no new element kind and no migration.
- **Mood stamps and tape are gone** from the toolbar, and any rows left over from either are no longer drawn.
- **Edit Journal** and **Add meal** are two wide buttons under the book, as in the prototype.

## v4.14 · 2026-11-18 — A wider fridge and a real ring binder
- **The fridge fills its column.** It was sized from the viewport height, which left a gap beside it; it is width-driven again (up to 520px) and the aspect ratio gives the height. The artwork is a little stockier (386×710 rather than 386×780) and its column took the extra space from the pantry panel.
- **The journal page is a ring binder** (`components/journal/Binder.tsx`): a cover, a brushed-metal spine, and three chrome rings clamped over the paper. The rings are drawn, not photographed, with the same metallic ramp as the fridge handles — the back half of each ring renders behind the page and the front half over it, which is what makes the sheet look threaded on rather than pasted under. The ruled paper and everything on it are unchanged.

## v4.13 · 2026-11-18 — Magnets on the fridge door
- **Nine magnets from your own sheet** (`Magnet Vector Asset.png`): lemon, orange slice, strawberry, apple, kiwi, blueberries, egg on toast, baguette, cheese. The sheet was cut by finding the connected blobs of non-transparent pixels, so each magnet is trimmed to its own artwork rather than a guessed grid, and saved at 256px in `public/magnets/`.
- **Upload a sticker is gone.** Decorating is now: tap a magnet from the tray to put it on the door, drag to move, corner to resize, × to remove. Positions are still percentages of the door, so a door arranged on a laptop looks right on a phone.
- A magnet is a `fridge_decor` row with `kind: 'magnet'` and its name in `color`, so no migration was needed. Leftover photo stickers are ignored and fall away on the next save.
- The fridge page is now **What's in My Fridge?**

## v4.12 · 2026-11-18 — Every recipe shows calories
- **No recipe says "ask Claude" any more.** `lib/nutrition/estimate.ts` works a figure out from the recipe's own ingredient list — the measure converted to grams, a calorie density matched on words in the name — and the tile shows `~755 kcal` with **estimated** under it. No API call, no key, no wait.
- Seasonings count as zero rather than being guessed at, a bare count ("2 chicken breasts") is read as pieces, and the result is rounded to the nearest 25 because pretending to more precision would be the real lie.
- It gives up and shows nothing when fewer than two lines, or under a third of the list, could be read — one readable line out of a dozen is a guess, not an estimate.
- The servings stepper scales off the estimate too, so changing servings moves the number.
- 5 tests in `tests/estimate.test.ts` (41 in total).

## v4.11 · 2026-11-18 — Three doors, no video
- **To Buy is its own page** (`/to-buy`) and the third card on My Kitchen. It was a tab inside Fridge, which made that screen two screens under one title; the fridge is now just the fridge, the door, the shelves and the pantry.
- **My Kitchen reads like the frame**: Fridge / *See what's inside* / **Open**, Recipes / *Find and cook your next favorite meal.* / **Browse**, To Buy / *A little list for your next grocery trip.* / **Write**, each with a live count under it.
- **Saved sits last** in the recipe tabs, after *Cook from my fridge*, as a bookmark.
- **No YouTube anywhere in recipes**: the detail page leads with the photo, the player and the More-videos section are gone, and the video chip is off the cards.
- Recipe pages link out to **Allrecipes search** for other versions of the same dish — a link, not a copy. See the note below.

## v4.10 · 2026-11-18 — Recipes you can actually cook from
- **The second recipe source is gone.** It was demo data: ingredients listed as bare names with no quantities and a five-line method. You cannot cook from that, so it has no place in a cooking app. Every recipe now comes from TheMealDB, which carries real measures (`3/4 cup soy sauce`), a full method, a photo, a YouTube video and a link to the original. The `source` field stays on every card and tool so a genuine second source can join without touching the pages.
- **The method is split into steps you can follow while cooking.** Paragraphs first, then any paragraph over 200 characters is broken again at sentence ends — one action per line, not a word rewritten. The Teriyaki Chicken Casserole goes from 6 dense paragraphs to 10 steps, and "350° F" and "½ cup" are left intact rather than split down the middle.
- **Saved** in the recipe tabs is a bookmark icon, labelled for screen readers.
- The "Add a YouTube API key to show more videos here" line is gone; the section now shows just the search link until there are videos.
- 🐛 **The browser opened on a single recipe.** Its default view fired twelve `random.php` calls — all the same URL, so Next's fetch cache collapsed them into one response and the dedupe left exactly one card. It now lists a few random letters instead: distinct, cacheable URLs, 24 varied recipes.

## v4.9 · 2026-11-18 — The recipe bank
- **Find now searches a bank, not one API.** `lib/recipe-bank.ts` browses TheMealDB **and** a second free, keyless source (`lib/freebank.ts`). Nothing is scraped and no key is needed. Each source is awaited separately, so one being down shows the other's results with a note rather than an empty page.
- **The second source is the one that pays for itself**: its recipes state a real prep + cook time, a difficulty and **calories per serving**, which TheMealDB has none of. Those cards carry a kcal badge, their time has no `~`, and the servings stepper on the detail page works off real numbers.
- **Saving a bank recipe copies it in whole** as one of your own, keyed `bank:<id>`. It keeps its calories and times even if the source goes away, it stays editable, and it needs no migration — the schema's `source` check only allows `mine` and `themealdb`.
- **Cuisine and main ingredient are gone from the browser.** Find is Search · Meal type/diet · Cooking time · Difficulty. *Cook from my fridge* still searches by ingredient through its own path, so nothing was lost there; `listAreas` went with the filter.
- **The fridge's "use soon / low" magnet is gone** from the door.
- MCP: `search_recipes` takes `max_minutes` and `difficulty` instead of `area`/`ingredient` and returns a `source` per result; `get_recipe`, `save_recipe` and `add_missing_to_shopping` take that `source`.

## v4.8 · 2026-11-18 — My Kitchen is two doors
- **My Kitchen is the Figma frame**: *What's In My Kitchen?* over two tall grey cards — the illustrated icon, the name, a line of description and an **Open** button. Nothing else.
- Each card keeps a live count under its description (`7 items · 0 to buy`, `1 saved · 6 you could cook tonight`), so the doors still say what is behind them.
- **What can I cook tonight?, Use soon and To buy came off this page.** They were duplicating their own pages: cook-tonight is *Cook from my fridge*, use-soon and low stock are on the fridge door itself, and the shopping list is the fridge's To buy tab. The six shortcut tiles went with them, and `ServiceTile` with those.
- **The active navigation item is yellow** on the sidebar and the phone tab bar, as this frame shows.
- The fridge icon is two boxes with a gap and a handle each, and the bowl is a half disc under three strokes of steam — both matching the frame. Their gradients now run across the whole icon (`userSpaceOnUse`) instead of restarting on each shape.

## v4.7.1 · 2026-11-18 — White page, cream navigation
- **The page is white**, and the navigation carries the pale cream from your swatch — sampled off it and rebuilt as the gradient it is, `#FFFEFA → #FFFCF4 → #FEF9EA`, on the sidebar and the phone tab bar. The active item is the tinted one again now that the bar is nearly white.
- Cards get a warmer hairline and a 1px shadow so they still read as cards against white.
- **Other Services stands off the two cards** — 16px above the heading, 18px under it, 14px between tiles. Below 620px the row holds all four at 56px so the bigger art does not wrap it onto two rows.

## v4.7 · 2026-11-18 — Grey page, beige navigation, no floating camera
- **The page is light grey** (`#F3F2F0`) instead of cream, so the white cards and the yellow / pink / green gradients lift off it, and **the navigation is beige** (`#EFE5D5`) — sidebar and phone tab bar both. The active item is the light one now.
- **More air around the logo and the nav items**: the sidebar has a taller top margin, 6px between items and 46px rows; in the 861–1100px icon rail the logo gets its own space above them.
- **Other Services icons are bigger** — 72px art in 120px tiles.
- **Discover good eats is gone**, and with it the **See all** link and the all-services sheet: the four shortcuts are the whole row, and everything else is reached from its own tab, from My Kitchen or from the sidebar.
- **A scan opens on the camera.** Arriving at `/snap` with a mode — *Scan a receipt*, a meal slot's `+`, *Scan groceries* — goes straight to **Open camera / Upload a photo / Enter by hand** instead of the list of scan types; *Scan something else* brings the list back.
- **The floating AI camera button is gone from every page.** Each scan is now started from where it belongs.

## v4.6 · 2026-11-18 — Home matched to the Figma frame
- **The logo is in the sidebar.** `logo-dailybite.png` cropped to its wordmark and knocked back to transparency (`logo-dailybite-wordmark.png`), replacing the coral mark and the typed "DailyBite".
- **Yellow greeting card.** Pale cream to saturated yellow, with *Good morning* in black and *Your daily balance* under it; the date sits top right.
- **Titles are black** (`--title-ink`), including the active sidebar item, which was coral.
- **The calorie ring is drawn, not a conic-gradient** (`components/CalorieRing.tsx`): a hairline track with one coral arc sweeping from the top, so it keeps a rounded cap at any size. The balance card now reads *N remaining* → *eaten/goal* → three thin macro bars, with the ring at the right.
- **The two cards carry their own gradients** — Today's Meal Plan white to pink, Today Food Spend white to green — instead of being plain white.
- **Illustrated service icons** (`components/ServiceArt.tsx`): solid gradient shapes with no tile behind them — a blue fridge, a yellow basket, a coral bowl with steam, a purple chart. Home now shows exactly those four, with **See all** opening the full sheet; progress, budget, calendar and the rest stay reachable there, from My Kitchen and from the sidebar.
- **AI camera** is a yellow pill with a camera glyph and black text, not a black pill with a coral dot.
- **Today's tip is gone**, and with it `makeTip`.
- 🐛 Calorie and money figures were formatted in the server's locale (`0/1.800`); they are pinned to `en-US` now.

## v4.5 · 2026-11-18 — Home, rebuilt from the Figma
- **Gradient greeting card.** Apricot → blush → lilac, with the date as a pill, the greeting in ExtraBold at `--text-3xl`, and a line saying how much of the day is logged. Search and the bell sit inside it.
- **The calorie ring moved into that card**, on its own white panel: kcal left in the middle, eaten-of-goal beside it, and the three macro bars under that. Still one coloured arc per meal.
- **Today's Meal Plan beside Today Food Spend.** The meal plan is four rows — a meal-coloured dot, the photo, the name and kcal — with empty slots dashed and a `+`; *Up next* is now a footnote on it rather than its own card. Food Spend leads with today's number, then the month bar, what's left in mint, and *Scan a receipt*. This replaces "What have I eaten today?" and the old Up next card.
- **Other Services tiles are gradient chips** — two palette colours each, the icon in a dark enough shade of the same hue to stay legible. The grid no longer sits in a white card.
- Quick actions (Log meal, Scan receipt, Cook, My progress) are white circles on the gradient instead of black ones on apricot.
- Two columns above 980px, stacked below; nothing scrolls sideways at 390px.

## v4.4 · 2026-11-18 — The fridge is drawn, not photographed
The fridge is now hand-authored vector art (`components/fridge/FridgeArt.tsx`), one SVG per door.
- **Colour is a real fill**, not a tint laid over a bitmap, so every finish stays clean and the chrome keeps its own metallic ramp. All the shading — top light, lit free edge, hinge-side shadow, two reflection stripes, a hairline enamel rim — sits above the body colour, so one drawing suits cream and coral alike.
- **Chrome bar handles** on two stand-offs, meeting at the door seam, with the gap throwing a shadow onto both doors. Kickplate at the foot.
- **It fits the screen.** A fridge is about twice as tall as it is wide, so height runs out first: the unit is sized from the viewport (`min(800px, 100vh - 210px)`) and the aspect ratio gives the width — falling back to width-driven sizing below 860px.
- The sliced product-photo PNGs in `public/fridge/` are gone; nothing references them.
- **The Fridge page follows the Figma**: three columns — the fridge, a dashed **Pantry Cupboard** panel listing everything on the pantry shelf, and an **Add item** card with *Cook from my fridge* under it. Two columns below 1100px, stacked below 760px.
- Primary buttons are the logo's yellow (`#FFD24A`) with ink text. The gingham backdrop is gone — the fridge sits on the page's own cream.
- 🐛 The fridge page scrolled sideways at 390px: a grid column is min-content wide by default and the three-up Qty/Unit/Expires row would not shrink. `min-width: 0` on the columns and the form fields.

## v4.3.1 · 2026-11-18 — A more convincing fridge
Pushed the fridge toward the look of a photographed retro unit, working from your vector rather than copying anyone else's product shot.
- **Contact shadow** under the unit — tight and dark where it meets the floor, falling off outward — instead of a flat drop shadow.
- **Enamel sheen**: a diagonal highlight masked to each door's own silhouette, so it curves with the artwork and never spills past the rounded corners.
- **Gingham backdrop** behind the fridge, the way these retro units are always photographed.
- **A believable interior**: cool-white cabinet with light falling from the top, glass shelves rendered as translucent slabs with a lit front edge, and a tinted freezer compartment.
- **Cream** added as a finish, matching the classic retro look.
- Leftover post-it and magnet rows from the old decoration tray are ignored and drop away on the next save.

## v4.3 · 2026-11-18 — The real fridge vector, and it opens
- **`Fridge vector asset.png` is now the fridge.** A PowerShell pass found the chrome divider at 34% of the body and sliced the artwork into `fridge-door-freezer.png` and `fridge-door-main.png`, white knocked out to transparency, in `public/fridge/`.
- **The doors actually open.** Each door is its own image layer hinged on the *right* edge — the handles are drawn on the left — and swung away on a CSS 3D `rotateY(118deg)`, revealing shelves drawn behind. The chrome handles themselves are the click targets, as on a real fridge.
- **Colour keeps the artwork.** A tint masked to the door's own silhouette and blended with `mix-blend-mode: color` replaces the hue while keeping the chrome highlights and shading; a flat fill would have thrown that detail away. Seven choices: the original finish plus the six brand colours.
- **Stickers replace the old decoration tray.** Tape, post-its, notes, badges and magnets are gone per the brief; what remains is upload → drag → resize → remove, working today with your own images. Sticker width rides in the unused `text` column, noted for a migration later.
- Logo swapped to `dailybite logo yellow.png`.
- 🐛 The door would not cover the interior at first: the modifier class `main` collided with the app shell's global `.main` layout class and forced `display:flex` on the layer. Modifiers are now prefixed (`door-main`, `part-main`, `hit-main`).

## v4.2 · 2026-11-18 — New design system: Headspace Apercu + the six-colour palette
- **Headspace Apercu, properly loaded.** The three `.otf` files are served from `public/fonts` through `@font-face` at weights 300 / 500 / 800, and the Google Fonts link (Inter + Caveat) is gone — no network font requests remain. ExtraBold for titles, Medium for subtitles, cards, nav and buttons, Light for body copy. The journal handwriting accent now uses Apercu Light rather than Caveat.
- **A responsive type scale** on `clamp()`: titles stay prominent on a desktop without overwhelming a phone, body text never drops below ~15 px.
- **The six brand colours** — `#FFCAD4` `#D9EFFD` `#C2FFE5` `#FF877E` `#FFDBA7` `#EDD4FF` — drive the interface, with **`#FF877E` as the primary accent replacing every red**. Backgrounds moved from grey paper to warm cream (`#FFF8F0`).
- Applied by **redefining the design tokens**, so every page, card, chip and button re-skins at once rather than each file drifting. The old Chroma names are aliased onto the new palette so nothing can still render the old red.
- Coral buttons use ink text, not white: `#FF877E` with white fails contrast at 2.3:1, with ink it passes at ~7:1.
- Fridge colours are now exactly the six brand colours, and tape is gone from its tray.

## v4.1 · 2026-11-17 — Phase 4: the scrapbook journal page
`app/(app)/journal/Scrapbook.tsx`, from `D05-Journal`. The day page is now something you make rather than fill in.
- **Decorate page** turns the page into a canvas: six food stickers, mood stamps, washi tape, handwriting text and freehand doodles.
- **Drag to move, corner handle to resize, top handle to rotate, × to delete.** Saves 500 ms after you stop, debounced *per element*, so moving one sticker never rewrites the rest of the page.
- **Doodles are drawn freehand** on the page and stored as an SVG path in `data.path`, exactly as the plan specified.
- Positions use the schema as designed — x and width as percentages of the page, y in pixels — so a page made on a laptop still reads on a phone.
- **Photo** opens the AI camera at `/snap?mode=journal` rather than duplicating a picker; cropping and linking a photo to a meal from inside the editor are still to come, as are mood stickers feeding Progress habits and the week-plan page kind.
- Verified end to end: two stickers placed in the browser arrived in `journal_elements` as `x=48.8% y=237px w=14% rot=-6 z=0`.

## v4.0 · 2026-11-17 — Phase 4: the digital fridge
`/fridge` is no longer a list. `components/fridge/Fridge.tsx` ports `D06-Fridge` / `M05-Fridge`:
- **Doors that open.** Handles swing the freezer and fridge on a CSS 3D `rotateY(-112deg)` (104° on phones, instant under `prefers-reduced-motion`), revealing shelves — freezer, dairy & eggs, proteins, crisper drawers, shelf — with the pantry cupboard beside the fridge.
- **A door you decorate.** Post-its, notes, badges, magnets and tape, dragged with pointer events, tilted, retyped or removed, plus seven fridge colours. Saved through the existing `saveDecorAction` 600 ms after a drag ends.
- **Positions are percentages of the door, not pixels**, so a door arranged on a laptop still looks right on a phone.
- **A status magnet** on the door counts what needs attention: use-soon and low-stock items.
- **Tap an item** for Use 1 / Restock / Remove / Recipes using this; items expiring or low are flagged on the shelf itself.
- Verified end to end: a post-it dropped on the door appears in `fridge_decor` with its percent coordinates, rotation and colour a second later.

## v3.11 · 2026-11-17 — Fix the scan that hung on "Analysing your meal…"
Measured against the same pizza photo: `gemini-flash-latest` **timed out at 15 s** (Google is saturating it), while `gemini-3.1-flash-lite` answered in **4.2 s**. The spinner was simply waiting on a model that never replied.
- **Model chain instead of one model**: `gemini-3.1-flash-lite` first, `gemini-flash-latest` as backstop, 13 s per attempt so the whole chain fits inside the serverless budget. A rejected key still fails immediately — only timeouts, 404s, rate limits and outages move to the next model.
- `GEMINI_MODEL` now *leads* the chain rather than replacing it, so pinning a model never removes the fallback.
- **The spinner can no longer hang**: the browser aborts the scan request after 75 s and says so, instead of spinning forever if the response is lost.

## v3.10.1 · 2026-11-17 — Food search uses the endpoint that works
- Open Food Facts `/api/v2/search` was returning 503 HTML while the long-standing `cgi/search.pl` answered fine and ranked better ("nutella" → Nutella, not bottled water). Search now calls the legacy endpoint first and falls back to v2.
- The relevance filter no longer empties the list: if scoring discards everything, the raw results are shown instead.

## v3.10 · 2026-11-17 — Barcode scanning and food search (the MyFitnessPal part)
Photo analysis only covers cooked meals. The everyday case — a packaged food with a barcode — now works like MyFitnessPal, and **needs no API key at all**.
- **Open Food Facts** (`lib/nutrition/openfoodfacts.ts`, free and open, no account): barcode lookup and free-text search, with kJ→kcal conversion for entries that only carry kilojoules, and products with no calorie data dropped rather than shown as blanks.
- **Relevance ranking of our own.** Their search sorts by popularity, so "greek yogurt" returns bottled water; results are now scored by how much of the query appears in the product name and unmatched entries are discarded.
- **`/api/food`**: `?barcode=` or `?q=`. Read-only, sends nothing about the user beyond the search text, and identifies the app generically in the User-Agent.
- **New "Barcode & search" mode in `/snap`**: live barcode scanning through `BarcodeDetector`, with typing the digits as the fallback everywhere it is missing (Safari has no support). Then a serving picker — the pack serving, 100 g, or grams you type, times a quantity — that recalculates kcal and macros live.
- Picks collect into a basket, then **Review & save** drops them into the same editable meal form as a photo scan, marked **from food database**.
- Every failure degrades to something usable: no barcode match, rate limiting, no camera.

## v3.9 · 2026-11-17 — Nutrition from a database, not the model memory
Borrowed the one good idea from `sunilpowar5/LangGraph-MCP-Nutrition-Analyzer` (a Streamlit demo, no licence, nothing to port): split identification from nutrition.
- New `lib/nutrition/nutritionix.ts`. The vision model names the food and judges the portion; **Nutritionix supplies the calories and macros**. Where a lookup succeeds its numbers win; where it fails the model estimate is kept, so a lookup outage never costs a scan. Returns `[]` and degrades silently when the keys are absent.
- Rows now carry `source: "db" | "ai"`, and the review form marks looked-up items **from food database** so an estimate is never mistaken for a measurement.
- 12 s timeout on the lookup, inside the existing serverless budget.
- Needs `NUTRITIONIX_APP_ID` / `NUTRITIONIX_API_KEY` (free tier). Without them nothing changes.

## v3.8.1 · 2026-11-17 — Scans fail fast instead of timing out
- A Gemini outage used to hang the request until Vercel killed the function at 60 s and returned an opaque 504. Each attempt now aborts after 22 s, with **one retry** on 429/5xx, so the worst case still fits inside the serverless limit and the user gets a sentence instead of a gateway error.
- **Thinking disabled** (`thinkingBudget: 0`): reading a plate is perception, not reasoning, and thinking tokens only spent latency we do not have in a single serverless call.
- Added the 503 case to the error messages ("Gemini is overloaded right now — try again in a moment").

## v3.8 · 2026-11-17 — Food recognition switched on (Gemini)
- The food camera now really analyses photos: Gemini is the configured provider, on the free tier, with the key server-side only.
- **Default model is the `gemini-flash-latest` alias, not a pinned version.** Google now returns 404 for `gemini-2.5-flash` to new keys ("no longer available to new users"), so a pinned number is a time bomb; the alias always resolves to the current flash model. `GEMINI_MODEL` still overrides.
- Verified on a real meal photo: one plate of pasta came back as "Penne alla Vodka", dinner, 280 g, 520 kcal, 14 g protein, 66 g carbs, 22 g fat, with ingredients listed and a note explaining the portion assumption.

## v3.7 · 2026-11-17 — Automatic in-app food recognition
- **Gemini vision provider** (`lib/vision/gemini.ts`), now the default pick because its free tier needs no card. `getVisionProvider()` chooses by whichever key is set — `GEMINI_API_KEY` first, then `ANTHROPIC_API_KEY` — or `VISION_PROVIDER` to force one. The key stays server-side; the browser never sees it.
- **Removed the "Let Claude read it instead" panel.** Taking or uploading a photo analyses it automatically: upload → "Analysing your meal…" → the form arrives filled with meal name, slot, and one card per food with portion, grams, kcal, protein, carbs, fat and ingredients. Nothing is clicked to start it, and nothing is saved until **Save to my journal**.
- Gemini failures read like instructions rather than status codes: rejected key, model not found, free-tier rate limit, blocked photo, service down.
- `.env.example` documents the provider choice.

## v3.6 · 2026-11-17 — Correcting AI estimates, and the no-key route
**Meals can finally be edited.** A meal could be confirmed or deleted but never corrected, which made an AI estimate all-or-nothing. New `app/(app)/journal/MealEditor.tsx`: meal name, slot, and per-item food / portion / grams / kcal / protein / carbs / fat, add and remove items, totals recomputing as you type, then **Save & mark eaten** or **Save changes**. Opens at `/journal?meal=<id>&edit=1`; Home's **Edit** on "Check these AI estimates" now goes straight there. Totals are recomputed server-side by `updateMeal`, so the saved numbers always match the items.
- Meals estimated by AI now carry an **AI estimate** chip in the journal.
- **No vision key, no dead end.** With no provider configured, `/snap` now explains the route that needs no API key: send the photo in the Claude app and say "log this meal in DailyBite" — Claude reads it and writes it through the MCP connector as `pending_confirm`, and it appears on Home for you to correct and confirm. The vision provider layer stays in place, so dropping in a key later turns the in-app analysis on with no other changes.

## v3.5 · 2026-11-17 — Real AI food recognition on the camera
- **Swappable vision provider** (`lib/vision/`): `VisionProvider` contract, an Anthropic implementation, and `getVisionProvider()` chosen by `VISION_PROVIDER` (default `anthropic`). `/api/scan` no longer knows who answers; changing provider is one new file. The key stays server-side, as before.
- **Per-item recognition.** The calorie prompt now asks for every distinct food separately with portion text, **grams**, kcal, protein, carbs, fat, visible **ingredients**, an `unsure` flag, and which **meal slot** the photo looks like. Model output is validated field by field (`cleanRow`) — a model returning a string where a number belongs can no longer poison the form.
- **A real editing step.** Each item is now a card with its own kcal / protein / carbs / fat inputs plus portion and grams; ingredients are listed; items can be added or removed; **meal totals recompute on every keystroke** across all four macros, not just calories.
- **Retry without re-uploading**: "Analyse the photo again" re-runs the scan on the photo already in storage.
- Honest copy: figures are labelled estimates from the photo, the save button reads "Save to my journal", and nothing is written until it is pressed.
- `MealItem` in `lib/schemas.ts` gained `grams` and `ingredients`, so what the AI estimated is kept on the saved meal and is visible to MCP tools too.

## v3.4 · 2026-11-17 — The AI camera opens a real camera
- **`/snap` now opens the device camera** (laptop webcam, iPad, phone) instead of only a file picker: live preview, a shutter button, and a Flip control when the device has more than one camera. New `app/(app)/snap/CameraCapture.tsx`.
- The still is drawn to a canvas at the camera's own resolution and uploaded as JPEG (quality 0.9) through the existing `uploadScanPhotoAction`, so nothing else in the scan flow changed.
- Camera tracks are stopped on cancel, after a capture and on unmount — the camera light never stays on.
- Honest fallbacks instead of a dead button: separate messages for a blocked permission, no camera on the device, a camera already in use by another app, and a non-HTTPS page (getUserMedia needs a secure context; localhost and the Vercel site both qualify). **Upload a photo** stays available in every case.
- iOS specifics handled: `playsInline` + `muted` so Safari renders the preview inline, and the stream only starts from a tap.

## v3.3 · 2026-11-17 — Phase 3: live on Vercel
**https://dailybite-ten.vercel.app** — the app and its 53-tool MCP server now run without anything on the laptop.
- **Pinned the database with `DAILYBITE_SUPABASE_URL` / `DAILYBITE_SUPABASE_SERVICE_KEY`** (`supabaseTarget()` in `lib/supabase/admin.ts`). A Supabase connection added through Vercel provisions its own empty Supabase project and injects `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` at deploy time, overwriting the dashboard values — so every page 500d with "Could not find the table in the schema cache" while `/api/mcp` kept answering 401. The `DAILYBITE_*` pair wins when set.
- Turned off Vercel Authentication, which is on by default for new projects and blocks the MCP connector as well as the browser. The app has no sign-in, so **the deployed URL is open to anyone who has it**.
- `APP_URL` set, so MCP tool results deep-link to the live app instead of localhost.
- Verified live: 13 routes return 200, `tools/list` → 53, and `today` / `get_daily_summary` / `get_kitchen_overview` answer from the migrated project.

## v3.2.1 · 2026-11-17 — Phase 3: source control
- First commit and push: **github.com/nathjocelyn06/dailybite** (private). 120 files, no secrets — `.env.local` is covered by `.gitignore` and nothing tracked contains a key.
- Recorded which environment variables the deployed app actually reads: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_USER_ID`, `MCP_ACCESS_KEY`, `DEFAULT_TIMEZONE`, `APP_URL`, plus the optional AI/YouTube/MealDB keys. `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `OWNER_EMAIL` have been dead since v3.1 and are now marked as such in `.env.example`.

## v3.2 · 2026-11-16 — Phase 2 polish
**Calendar (Archive) grew week and day views** (`?view=month|week|day`, wireframe `D02-Calendar`). Week: seven columns, one box per meal slot — dashed while planned, meal-coloured once filled — with kcal and spend per day. Day: an hour timeline that places each meal by its `eaten_at` time, falling back to a sensible hour for its slot when it was never timed. Prev/next step by whichever view you are in. New `weekOverview` in `lib/services/calendar.ts`.

**Write your own recipes.** `/recipes/edit` creates, `/recipes/edit?id=` edits: ingredient rows you can add and remove, steps one per line, servings, time, calories, difficulty, cuisine, folder and links. Reachable from Saved → **+ New recipe**, from each own-recipe card, and from **Edit recipe** on the detail page. `MyRecipeInput` lives in `lib/schemas.ts`; `createMyRecipeAction` / `updateMyRecipeAction` wrap the existing services. TheMealDB recipes stay read-only and say why. `saveRecipe` now accepts a partial own-recipe instead of demanding every column.

**Serving scaler** on every recipe. `lib/scale.ts` (pure, 11 new tests) reads "1 cup", "200g", "1 1/2 tbsp" and "½ cup", scales them, and prints cooking fractions back — ½, 1½, ⅔. Anything it cannot read, like "to taste", is left exactly as written rather than guessed at. Scaling is display-only; nothing is saved. Recipes without a stated serving count assume 4 and say so.

**Budget weekly/monthly toggle and expense editing.** `?period=week|month`, with prev/next stepping by the chosen period. A week has no budget of its own, so it shows seven days' share of the monthly budget, labelled as such. History rows gained **Edit**, which fills the side form (`?expense=`); new `spendSummary` service and `updateExpenseAction`.

**Archive month/year browser.** A side panel grouped by year, with a record count per month, filtering the list to that month. Only months that actually hold records are listed, so there are no dead links. New `archiveMonths` service.

`npm run check` passes (36 tests, up from 25). Verified in the browser at desktop and 390 px: a recipe was created, scaled 2 → 4 servings (200 g → 400 g) and deleted again.

## v3.1.2 · 2026-11-16 — Phase 0 complete, first run against real Supabase
- **Fixed a race in `getSettings`** found the moment the app first loaded: Home reaches it through both `getDailySummary` and `expenseSummary`, so on an account with no settings row yet, two inserts collided and the page died with `duplicate key value violates unique constraint "settings_pkey"`. It now does insert-or-ignore (`upsert … ignoreDuplicates`) and reads back whichever call won. This was latent from the start, not caused by v3.1.
- Supabase live: both migrations run, all 16 tables verified over REST, owner user created through the Auth admin API and auto-confirmed, `.env.local` complete.
- **MCP smoke test passed:** 53 tools over Streamable HTTP, 401 without `?key=`, `today` → 2026-11-16 (Asia/Seoul), `log_meal` → `confirm_meal` → `get_daily_summary` → 620/1800 kcal. `get_app_map`, `get_kitchen_overview` and `get_progress_overview` all return the v3 shape.
- **Layout verified** at 1440 px (sidebar), 1000 px (icon rail) and 390 px (bottom bar with the AI camera above it): four tabs only, Chroma palette, Home matching `D01-Dashboard` / `M01-Home`.

## v3.1.1 · 2026-11-16 — Real logo in the opening
- The logo opening now shows the brand lockup from `Dailybite logo.png` (the lower of the two in that sheet: the `DailyBite` wordmark over the blue gradient bowl), cropped to its ink box and saved with a transparent background as `public/logo-dailybite.png` (1199 × 463). It scales to `min(320px, 66vw)`, pops in once and fades out — the drawn placeholder mark, wordmark and Caveat tagline are gone.

## v3.1 · 2026-11-16 — No sign-in, logo opening
**The app opens on Home.** A CSS logo opening (`.splash` in `app/(app)/layout.tsx`, `.splash*` in `app/globals.css`) fades itself out over ~1.5 s — `pointer-events: none` from the first frame, ending on `visibility: hidden`, so it can never block the page. Reduced-motion users get a short fade and no movement.
- **Removed:** `app/login/`, `app/auth/callback/`, `middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, and the Sign out button in Settings. No magic links, no session cookie, no owner-email gate.
- **One owner, server-side only.** `webDb()` now returns `ownerDb()`: the service-role client scoped to `OWNER_USER_ID`. RLS is still on every table but dormant — the `.eq("user_id", db.userId)` filter in `lib/services/*` is now the only thing scoping the data, so that rule matters more than before. `SUPABASE_SERVICE_ROLE_KEY` and `OWNER_USER_ID` are now required for the web app, not just MCP.
- **The browser no longer talks to Supabase at all.** Photo uploads from `/snap` go through the new `uploadScanPhotoAction` (server action → `uploadPhoto` → private bucket) instead of the anon-key storage client; the anon key is unused. `/snap` lost 69 kB of JS (175 kB → 106 kB first load).
- **LiveSync polls instead of subscribing.** Realtime needs an authenticated client, so `components/LiveSync.tsx` re-renders every 10 s while the tab is visible, on focus, and at local midnight. Cross-device and MCP changes still land within a few seconds.
- **Trade-off, on purpose:** there is no access control left in the app. On localhost that is fine; a deployment needs Vercel password protection, an allowlist, or the sign-in brought back (Phase 3 notes this).

## Unreleased · 2026-11-16 — Phase 0: first real install
- First `npm install` against the real registry: `@modelcontextprotocol/sdk` pinned to **1.26.0** and `mcp-handler` to **1.1.0** (mcp-handler 1.1.0 declares an exact peer on SDK 1.26.0; 2.x is a different API on `@modelcontextprotocol/server@^2`). Everything else resolved inside its range (next 15.5.29, react 19.3.1, @supabase/ssr 0.6.1, supabase-js 2.119.0, zod 3.25.76, vitest 3.2.7, typescript 5.9.3).
- `npm run check` now passes: typecheck clean, 25 tests pass, `next build` succeeds (22 routes + middleware).
- Fixes for the real library types: explicit `setAll(list: Parameters<SetAllCookies>[0])` in `lib/supabase/server.ts` and `middleware.ts` (the overloaded `createServerClient` in @supabase/ssr 0.6.1 gives no contextual parameter types), and `.single<Settings>()` in `lib/services/settings.ts` (an untyped `SupabaseClient` infers `data: null` for insert/update + select). No change needed in `lib/mcp/tools.ts` or the MCP route. (Both cookie fixes were superseded hours later: v3.1 deletes those two files with the sign-in.)

## v3 · 2026-11-04 — Narrowed DailyBite, Chroma palette, AI progress overview
**Scope: four destinations, one job each.**
- **Home** = today. Also holds **My progress** (`/progress`), **Budget** (`/budget`) and **Notifications** (`/notifications`, bell icon). Quick actions: Log meal, Scan receipt, Cook, My progress. Water card and reminders card removed (the bell shows reminders).
- **My Kitchen** = food at home only. Budget and Calendar moved out. Two cards: **Fridge** (Stock · To buy · Scan groceries) and **Recipes** (Find · Saved · Cook from my fridge), then *What can I cook tonight?*, Use soon and a To buy preview.
- **Journal** unchanged.
- **Archive** = the past: **List** and **Calendar** (`/calendar` now belongs to Archive) behind a List / Calendar switch.
- Messages renamed **Notifications** (`/messages` redirects). Settings stays behind the avatar.
- **Cut for now:** health articles + workout videos (`/insights` → `/progress`), water tracking (`add_water` removed; table kept), body photo journal UI (table kept), reflection notes on Progress.

**Look: Chroma palette** (`app/globals.css`). Paper `#EDEDEB`, ink `#231F1C`, grid `#C9C9C6`; vermilion, signal red, amber, sun, coral rose, blush; lilac, periwinkle, cobalt, deep ocean, emerald. Home hero pastel yellow `#FDF1B8`, Today's tip `#F2D04A`, primary buttons sun yellow, active nav cobalt tint / deep ocean. The calorie ring is now the plate: one segment per meal (breakfast amber, lunch vermilion, dinner lilac, snack blush). Service tiles get a colour each via `SERVICES[].tone` → `.tone-*`.

**AI progress overview** (My progress)
- `lib/overview-facts.ts` (pure): `buildFacts`, `fallbackOverview`, `parseOverview`, `NEXT_LINKS`.
- `lib/services/overview.ts`: `getProgressOverview(db, "week" | "month", { refresh })` → Claude writes headline, summary, going well, I noticed, try next (JSON, whitelisted links); rule-based fallback without `ANTHROPIC_API_KEY`; cached per day.
- Migration `supabase/migrations/0002_v3_ai_overviews.sql` (table `ai_overviews`, RLS).
- Page: overview on deep ocean with This week / This month, Refresh overview, "not medical advice" line; averages, 30-day chart and goals below. `refreshOverviewAction` in `app/(app)/actions.ts`.

**Code**
- `lib/nav.ts` rewritten (sections, groups, tones, Archive owns `/calendar`, Home owns `/budget`, `/progress`, `/notifications`).
- `lib/services/kitchen.ts` rewritten: fridge + To buy + saved count + cook-tonight suggestions (network lookups never break the page).
- New routes: `/notifications`; redirects: `/messages`, `/insights`. Labels: Fridge tabs Stock / To buy; Recipes tabs Find / Saved / Cook from my fridge.
- `components/NavIcon.tsx` new icons (notifications, receipt, saved, cook, search); `components/Services.tsx` uses tones.

**MCP: still 53 tools.** Removed `add_water`. Added `get_progress_overview`. `get_kitchen_overview` now returns fridge, To buy, saved count and cook-tonight ideas (no budget, no week plan). Server instructions describe the v3 app map.

**Wireframes** replaced with the v3 canvas (D10 Insights removed, D11 is Notifications, D08 My progress with the AI overview, Archive + Calendar switch).

**Verified here:** 25 unit tests pass (nav + AI overview facts/fallback/parser); changed files type-check against stubbed library types. **Not yet:** `npm install`, `next build`, a run against Supabase, or a live call to the Anthropic API (no npm access here). Phase 0 covers it.

## v2 · 2026-11-04 — DailyBite, 4-tab navigation, Gojek-style Home
**Renamed** Nutrigo → **DailyBite** (app title, PWA manifest, login, MCP server text, package name). Database tables, env vars and the `/api/mcp` URL are unchanged, so an existing Supabase project and Claude connector keep working.

**Navigation: four destinations only**
- `lib/nav.ts` rewritten: `TABS` (Home, My Kitchen, Journal, Archive), `SERVICES` (every feature with its parent tab, short label, icon, description), `HOME_GRID`, `KITCHEN_SERVICES`, `sectionOf()`, `breadcrumbFor()`.
- `components/AppShell.tsx`: sidebar with the 4 tabs + an Account section (Messages with unread badge, Settings); breadcrumb on secondary pages; phone bottom bar with exactly 4 tabs, safe-area padding, active tab in sage.
- `app/globals.css`: compact icon rail at 861–1100 px, fixed bottom bar ≤ 860 px, service grid, hero, tip banner, sheet styles. New tokens `--sage-ink`, `--deep`.
- `components/NavIcon.tsx`: real stroke icons for every key (still the one icon slot).
- All existing routes kept. `/more` is now the Account page (Messages + Settings), not a tab.

**New pages / components**
- `app/(app)/kitchen/page.tsx` — **My Kitchen** hub: service grid with live counts (Recipes, Digital fridge, Grocery list, Budgeting, Meal planning), use soon + low stock, tick-off grocery list, 7-day meal strip, budget card.
- `lib/services/kitchen.ts` — `getKitchenOverview(db)` (shared by the page and MCP).
- `components/Services.tsx` — `ServiceTile`, `ServiceGrid` (with a **More** tile) and the all-services sheet ("Top services" + "Other services" grouped by tab; Escape/backdrop closes, focus moves to Close).

**Home redesigned** (`app/(app)/page.tsx`, inspired by Gojek's home): sage hero with search (→ Archive) and account avatar, "today" card (calories ring + macros → Progress, budget, water) with quick actions (Log meal, Add expense, Plan meal, Insights), service grid + More sheet, one data-driven tip banner (expiring item → recipes; low stock → grocery list; nothing planned → calendar), pending AI estimates, What have I eaten today?, Up next, reminders, water, discover saved recipes. Nothing from the old dashboard was removed.

**MCP: 51 → 53 tools**
- `get_kitchen_overview` — the My Kitchen hub in one call.
- `get_app_map` — the 4 tabs, every feature under them and the account menu, with deep links.
- Server instructions and result links now say DailyBite.

**Wireframes** (`design/wireframes/`): replaced with the v2 canvas — new D00 My Kitchen, M07 My Kitchen (was M07 More), M08 Archive; D01/M01 Home redesigned; every desktop screen has the 4-tab sidebar and breadcrumbs.

**Docs**: PLAN.md (new "Navigation v2" section, page table, tool count), MCP_TOOLS.md, CLAUDE.md (nav rules), README.md, CLAUDE_CODE_PROMPT.md.

**Verified here**: 21 unit tests pass (5 new for navigation); new and changed files type-check against stubbed library types. **Not yet**: `npm install`, `next build`, or a run against Supabase (no npm access in this environment) — Phase 0 covers it.

## v1 · 2026-10-29 — Nutrigo starter
Next.js 15 + Supabase app with 10-item sidebar, phone tab bar with More, 51 MCP tools, SQL migration with RLS, wireframes D01–D13 / M01–M07, build plan.
