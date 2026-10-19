# Buddy emergency fund — Copy and question sets

The quoted text below matches `app/data/buddy-esf.json`. Question and option
labels, recap fragments and multipliers match `app/data/emergency-fund.json`
→ `lifestyleModifiers`. These data files are the source of truth; regenerate
wrappers with `bash scripts/wrap-data.sh` after changing them. The model adds
live figures and recaps. [Buddy behavior](buddy-chat-esf-spec.md) defines the
panel, disclosures and handback; [fund behavior](emergency-fund-spec.md) defines
rows and estimates.

Buddy states composition and consequences without judging costs or recommending
choices. Shared payments count the participant's share. Multipliers are
prototype assumptions; each question has an option at 1.00. Preserve labels and
`short` fragments separately so a recap does not lowercase brand names.

## 1. Intro

Pack key: `0`.

> What can I help with?

### What is an emergency fund?

Entry: `whatIsIt`.

> It is money set aside for a bad month.

> A job loss. A big repair. Something you did not plan for.

> It sits in savings and you do not touch it otherwise.

### What will you ask me?

Entry: `whatYoullAsk`.

> Four screens of questions about what you pay each month.

> First your home and car. Then the bills that keep things running. Then a few that only some people have.

> At the end I show you the number and how long it takes to save.

### How long does this take?

Entry: `howLong`.

> A few minutes.

> Most rows already have a number in them. I worked those out from where you live and who lives with you.

> You only change the ones that look wrong.

## 2. Housing and Car Payments

Pack key: `1`.

> What can I help with?

### Rent

Entry: `rent`; ESF row: `rent`.

> Rent is what you pay your landlord each month.

> Put in your share only. If you split it with someone, count what comes out of your pocket.

> Include parking or storage if they are on the same bill.

> If your rent covers utilities, say so — I'll help you skip them later.

**[My rent covers utilities]**

Disclosure: `rentIncludesUtilities = true`.

> Got it. On the next screen, set Home utilities to $0.

> You already paid for them here. Counting them twice would make your fund bigger than it needs to be.

**[It doesn't]**

Disclosure: `rentIncludesUtilities = false`.

> Good — then fill in Home utilities on the next screen.

> I'll have an estimate ready for you.

### Mortgage

Entry: `mortgage`; ESF row: `mortgage`.

> Your mortgage is what you send the bank each month.

> Most people's payment also covers property tax and home insurance. That is called escrow.

> If yours does, include the tax and insurance in what you enter.

> Splitting the payment with someone? Count your share only.

**[Mine includes tax and insurance]**

Disclosure: `mortgageIncludesEscrow = true`.

> Then you are done with those.

> On the Living-related Expenses screen, leave Property Tax and Home Insurance alone.

> You have already counted them here.

**[Mine is just the loan]**

Disclosure: `mortgageIncludesEscrow = false`.

> Then add Property Tax and Home Insurance on the Living-related Expenses screen.

> I'll have estimates ready for you.

**[I'm not sure]**

> Look at your mortgage statement. If it lists "escrow" or shows tax and insurance broken out, they are included.

> About 4 out of 5 mortgages include them. If you cannot check right now, assume yours does.

**[Then mine probably does]**

Disclosure: `mortgageIncludesEscrow = true`.

> Then leave Property Tax and Home Insurance alone on the Living-related Expenses screen.

**[I'll check later]**

> Fair. I'll leave both rows there for you.

> Come back and tell me once you know — tap Mortgage again.

### Car payments

Entry: `carPayment`; ESF row: `carPayment`.

> This is just your car loan or lease payment. Nothing else.

> Not gas. Not insurance. Not repairs. Those come on the next screen.

> Paying off two cars? Add them together. Sharing one? Count your share only.

**[My lease includes maintenance]**

Disclosure: `leaseIncludesMaintenance = true`.

> Good to know. On the next screen, the Car row covers fuel, insurance and upkeep.

> Pick a lower range, since your upkeep is already paid here.

**[It doesn't]**

Disclosure: `leaseIncludesMaintenance = false`.

> Then the Car row on the next screen covers all three — fuel, insurance and upkeep.

### Public transportation

Entry: `transit`; ESF row: `transit`.

> What you spend getting around without a car. Bus, train, subway.

> Use your monthly pass. No pass? Add up a normal month of fares.

> Rideshare counts too if you use it to get to work or the store.

### Should I fill in both?

Entry: `bothRentAndMortgage`.

> Usually no. Most people pay rent or a mortgage.

> Fill in both only if you really pay both. That happens when you own a home but rent somewhere else for work.

> Or you own a mobile home and rent the land it sits on.

> Or you own a place you rent out, and rent where you live.

## 3. Keeping things running

Pack key: `2`.

> What can I help with?

### Home utilities

Entry: `power`; ESF row: `power`.

> This is your water, gas and electricity, all in one figure.

> Not sure? I can ask three quick questions and calculate it.

#### Lifestyle questions

**When is someone usually home?**

| Option | `short` | × |
|---|---|---|
| Someone's home all day | with someone home all day | 1.18 |
| It's a mix | with people in and out | 1.08 |
| Mostly mornings and evenings | out most of the day | 1.00 |

**Do you run heat or air conditioning?**

| Option | `short` | × |
|---|---|---|
| Most of the year | running heat or air most of the year | 1.25 |
| Just summer, or just winter | heating or cooling one season | 1.00 |
| Hardly ever | hardly using heat or air | 0.82 |

**How often do you cook at home?**

| Option | `short` | × |
|---|---|---|
| Most nights | cooking most nights | 1.06 |
| A few times a week | cooking a few times a week | 1.00 |
| Hardly ever | hardly cooking | 0.95 |

### Phone and internet

Entry: `connect`; ESF row: `connect`.

> This is your phone bill and your internet bill together.

> I counted a line for every adult and teenager in your household.

> If that is not right, let me ask you about it.

#### Lifestyle questions

**How many phone lines are on your bill?**

| Option | `short` | × |
|---|---|---|
| Just one | one phone line | 0.58 |
| Two | two lines | 0.79 |
| Three | three lines | 1.00 |
| Four | four lines | 1.17 |
| Five or more | five or more lines | 1.32 |

**What kind of plans are they?**

| Option | `short` | × |
|---|---|---|
| Unlimited data | on unlimited data | 1.00 |
| A mix | on a mix of plans | 0.90 |
| Smaller data plans | on smaller plans | 0.80 |
| Basic phones, no data | on basic phones | 0.62 |

**What about home internet?**

| Option | `short` | × |
|---|---|---|
| A fast plan | with a fast internet plan | 1.12 |
| A basic plan | with a basic internet plan | 1.00 |
| I don't have one | with no home internet | 0.72 |

### Groceries

Entry: `groceries`; ESF row: `groceries`.

> Groceries means food you cook and eat at home.

> Not restaurants or takeout. Those are not part of an emergency fund.

> Not sure what you spend? I can ask how you shop and calculate it.

#### Lifestyle questions

**How often do you shop for food?**

| Option | `short` | × |
|---|---|---|
| Most days | shopping most days | 1.15 |
| Three or four times a week | shopping three or four times a week | 1.08 |
| Once or twice a week | shopping once or twice a week | 1.00 |
| Every two weeks | shopping every two weeks | 0.95 |
| About once a month | shopping about once a month | 0.90 |

**Where do you shop most?**

| Option | `short` | × |
|---|---|---|
| Warehouse clubs (Sam's, Costco) | at warehouse clubs | 0.85 |
| Value stores (Walmart, Aldi) | at value stores | 0.90 |
| Regular grocery stores (Kroger, HEB) | at regular grocery stores | 1.00 |
| Higher-end stores (Whole Foods) | at higher-end stores | 1.30 |

**Is anyone eating differently?**

| Option | `short` | × |
|---|---|---|
| No, we all eat the same | everyone eating the same | 1.00 |
| Someone has a special diet | with a special diet in the house | 1.12 |
| We buy a lot of organic | buying a lot of organic | 1.15 |

### Medical

Entry: `medical`; ESF row: `medical`.

Variant resolver: `employerCoverage`.

**employer**

> Your health cover comes through your job.

> If the job stops, that cover stops with it.

> So this row is what your own plan would cost, not what comes out of your paycheck today.

**[That makes sense]**

> Good.

> The figure is a mid-level plan priced on the ages in your household.

> You can change it whenever you want.

**[I already buy my own insurance]**

> Then put in what you actually pay instead.

> Your cost will not change if you lose a job.

**own**

> This is insurance, copays, prescriptions, dental and vision.

> You already buy your own plan, so this number does not change if a job goes away.

> Put in what you actually pay.

**[What counts here?]**

> Your premium, plus what you pay at the counter.

> Copays, prescriptions, dental and vision.

> Leave out anything a flexible spending account already covers.

#### Lifestyle questions

**What kind of plan would you buy?**

| Option | `short` | × |
|---|---|---|
| Better coverage, less to pay at the doctor | on better coverage | 1.25 |
| Something in the middle | on a mid-level plan | 1.00 |
| The cheapest one, more to pay at the doctor | on the cheapest plan | 0.80 |

**Does anyone need care all year round?**

| Option | `short` | × |
|---|---|---|
| Someone sees a specialist | with someone seeing a specialist | 1.15 |
| Someone takes regular medication | with someone on regular medication | 1.08 |
| No, nothing regular | with nobody needing regular care | 1.00 |

### Car costs

Entry: `carCosts`; ESF row: `carCosts`.

> This is fuel, insurance and upkeep.

> Not your car payment — that was the last screen.

> Insurance is the largest part of it. It does not change with how far you drive.

**[I don't own a car at all]**

Disclosure: `noCarAtAll = true`.

> Then this row is $0. I've set it for you.

> No car, no running costs.

#### Lifestyle questions

**How far do you drive on a normal day?**

| Option | `short` | × |
|---|---|---|
| More than 60 miles | driving more than 60 miles a day | 1.70 |
| 40 to 60 miles | driving 40 to 60 miles a day | 1.45 |
| 20 to 40 miles | driving 20 to 40 miles a day | 1.22 |
| 10 to 20 miles | driving 10 to 20 miles a day | 1.00 |
| Under 10 miles | driving under 10 miles a day | 0.85 |
| I don't drive much at all | hardly driving | 0.62 |

**What do you drive?**

| Option | `short` | × |
|---|---|---|
| A truck or van | in a truck or van | 1.28 |
| An SUV or crossover | in an SUV | 1.14 |
| A sedan | in a sedan | 1.00 |
| A small car | in a small car | 0.88 |

**Gas or electric?**

| Option | `short` | × |
|---|---|---|
| Gas | running on gas | 1.00 |
| Hybrid | a hybrid | 0.88 |
| Electric | electric | 0.78 |

## 4. Living-related Expenses

Pack key: `3`.

> What can I help with?

### Credit card and loan minimums

Entry: `debt`; ESF row: `debt`.

> This is the smallest payment you must make each month. Not what you normally pay.

> If you lost your job, this is what keeps you out of trouble.

> Pick the row that sounds most like you.

### Property tax

Entry: `propertyTax`; ESF row: `propertyTax`.

> This is the tax on your home. It comes once or twice a year, so I ask for the yearly amount.

> First: is it already in your mortgage payment? Most are.

**[It's in my mortgage]**

Disclosure: `mortgageIncludesEscrow = true`.

> Then skip this row. You counted it on the housing screen.

**[I pay it separately]**

Disclosure: `mortgageIncludesEscrow = false`.

> Then add it here. I've worked out an estimate from typical home values where you live and your state's tax rate.

> Your tax bill has the real number if you want to check.

**[I'm not sure]**

> Look at your mortgage statement. If it lists "escrow", your tax is in there.

> About 4 out of 5 mortgages include it.

### Home insurance

Entry: `homeInsurance`; ESF row: `homeInsurance`.

> This protects your home.

> Like property tax, it is often inside your mortgage payment.

> Is yours?

**[It's in my mortgage]**

Disclosure: `mortgageIncludesEscrow = true`.

> Then skip this row too. You counted it on the housing screen.

**[I pay it separately]**

Disclosure: `mortgageIncludesEscrow = false`.

> Then add it here. I've put in an average premium for your area.

### HOA and housing fees

Entry: `hoa`; ESF row: `hoa`.

> Some neighborhoods and buildings charge a monthly fee.

> It covers things like landscaping, trash or a pool.

> Houses usually do not have one. Condos and townhomes usually do.

> Not sure? You would know — it is a separate bill every month.

### Anything else

Entry: `anythingElse`; ESF row: `anythingElse`.

> Anything you must pay every month that I have not asked about.

> Good examples: child support, alimony, a storage unit, care for a family member.

> Leave out anything you could stop. Streaming, gym, eating out. Those are not part of a safety net.

**[What about childcare?]**

> I leave childcare out on purpose.

> It is often the second biggest cost for a young family. But it mostly goes away if you lose a job.

> If you would still pay it, put it here.

## 5. Goal screen

Pack key: `plan`.

> What can I help with?

### Months of expenses covered

Entry: `coverageMonths`.

> This is how long your fund would last if your money stopped.

> 3 months covers a short gap between jobs.

> 6 months covers a longer search, or a job in a smaller field.

> 9 months covers a long search, or work that comes and goes.

> You can change it whenever you want.

### Breathing room

Entry: `breathingRoom`.

> Emergencies bring costs nobody plans for. A car repair. A flight home.

> This adds a little on top of your monthly number.

> 10% on $2,800 a month adds about $280 to each month you are covered.

### Already saved

Entry: `alreadySaved`.

> Money you could reach tomorrow if you had to.

> Checking, savings, cash.

> Not retirement accounts. Taking money out of a 401(k) early costs you taxes and a penalty.

### Target date

Entry: `targetDate`.

> When you would like the fund finished.

> A later date means saving less each month. An earlier one means more.

### What the big number means

Entry: `headlineNumber`.

> The big number is what is left to save. The smaller one underneath is the whole fund.

> They are different because you have already saved some.

## Content contract

Use each step's ordered `items`, not every key in `rows`; metadata is not copy.
An entry label is both the question-list label and the user's echoed bubble.
An optional `row` connects the entry to the live ESF figure and row visibility.
`say` contains one paragraph per bubble. Chips carry an id, label, optional
disclosure `sets`, replies and nested chips. Resolve `sayIf` and `chipsIf` through
`esfBuddySayFor()` and `esfBuddyChipsFor()` for variant entries.

Only the existing content is quoted here. Changes to participant wording or
answer choices require a separate copy scope.
