import type { MealPreset } from '../types/presets';

export const mealPresets: MealPreset[] = [
  {
    id: 'balanced-maintenance',
    title: 'Balanced Maintenance',
    summary: 'A well-rounded nutritional approach perfect for maintaining current weight while supporting overall health. Balanced macros and flexible food choices make this sustainable long-term.',
    tags: ['balanced', 'maintenance', 'general-health', 'flexible', 'beginner-friendly'],
    mealsPerDay: 3,
    snacksPerDay: 1,
    macroRangesPercent: {
      protein: 25,
      carbs: 45,
      fat: 30,
    },
    mealStructure: [
      {
        meal: 'Breakfast',
        goal: 'Balanced carbs and protein to start the day',
        examples: [
          'Oatmeal with berries, nuts and a scoop of protein powder',
          'Greek yogurt parfait with granola and fruit',
          'Eggs (2) with whole grain toast and avocado',
          'Smoothie: protein, banana, spinach, almond milk',
        ],
      },
      {
        meal: 'Lunch',
        goal: 'Substantial with mixed nutrients for sustained energy',
        examples: [
          'Grilled chicken salad with mixed greens, quinoa and vinaigrette',
          'Turkey wrap with whole grain tortilla, veggies and hummus',
          'Bowl with brown rice, black beans, corn, salsa and grilled protein',
          'Tuna salad sandwich on whole grain bread with side of vegetables',
        ],
      },
      {
        meal: 'Dinner',
        goal: 'Satisfying meal with protein and vegetables',
        examples: [
          'Grilled salmon or lean beef with roasted vegetables and sweet potato',
          'Chicken stir-fry with mixed vegetables over brown rice',
          'Lean turkey meatballs (6-8) with marinara and whole wheat pasta',
          'Baked cod with lemon, herbs and steamed broccoli + rice',
        ],
      },
      {
        meal: 'Snack',
        goal: 'Bridges hunger between meals, adds micronutrients',
        examples: [
          'Apple with almond butter (1 tbsp)',
          'Greek yogurt (small serving)',
          'Handful of nuts or seeds',
          'Carrot sticks with hummus',
        ],
      },
    ],
    evidence: [
      {
        title: 'Dietary Guidelines for Americans',
        source: 'U.S. Department of Agriculture and U.S. Department of Health and Human Services',
        note: 'Recommended macronutrient ranges for adults: protein 10-35%, carbs 45-65%, fat 20-35% of total calories',
        url: 'https://www.dietaryguidelines.gov/',
      },
      {
        title: 'Relationship between diet quality and health outcomes',
        source: 'Schwingshackl et al., The American Journal of Clinical Nutrition',
        note: 'Balanced dietary patterns are associated with reduced risk of chronic disease',
        url: 'https://doi.org/10.1093/ajcn/nqaa039',
      },
    ],
  },
  {
    id: 'dash-diet',
    title: 'DASH Diet (Dietary Approaches to Stop Hypertension)',
    summary: 'Clinically-proven to lower blood pressure. Emphasizes fruits, vegetables, whole grains, lean proteins, and low-fat dairy. Reduces sodium while increasing potassium, magnesium, and calcium intake.',
    tags: ['heart-health', 'blood-pressure', 'low-sodium', 'whole-foods', 'balanced', 'medical-recommended'],
    mealsPerDay: 3,
    snacksPerDay: 2,
    macroRangesPercent: {
      protein: 18,
      carbs: 55,
      fat: 27,
    },
    mealStructure: [
      {
        meal: 'Breakfast',
        goal: 'Whole grains and fruit; moderate sodium dairy',
        examples: [
          'Oatmeal with berries and low-sodium almond milk',
          'Whole grain toast with avocado and poached egg',
          'Low-fat Greek yogurt with fresh fruit and nuts',
          'Whole grain cereal with low-fat milk and banana slices',
        ],
      },
      {
        meal: 'Lunch',
        goal: 'Lean protein with vegetables and whole grain; minimal added salt',
        examples: [
          'Grilled chicken breast (4-6 oz) with large salad and olive oil-vinegar dressing',
          'Quinoa bowl with beans, vegetables and herbs (no added salt)',
          'Turkey sandwich (no salt added bread) with lettuce, tomato, cucumber; fruit side',
          'Baked cod (4-6 oz) with brown rice and steamed vegetables seasoned with herbs',
        ],
      },
      {
        meal: 'Dinner',
        goal: 'Vegetables and lean protein; herbs/spices instead of salt',
        examples: [
          'Baked chicken breast with roasted root vegetables and quinoa; seasoned with herbs',
          'Grilled salmon with asparagus, lemon and brown rice',
          'Lean beef or tofu stir-fry with plenty of vegetables and brown rice (use low-sodium soy sauce)',
          'Baked sweet potato stuffed with black beans, corn, salsa and guacamole',
        ],
      },
      {
        meal: 'Snack 1',
        goal: 'Fruit or vegetables; unsalted nuts',
        examples: [
          'Apple, banana or orange',
          'Carrot sticks with hummus (no added salt)',
          'Handful of unsalted nuts or seeds',
          'Low-fat Greek yogurt with berries',
        ],
      },
      {
        meal: 'Snack 2',
        goal: 'Protein or fruit; supports potassium intake',
        examples: [
          'Banana with handful of unsalted almonds',
          'Cottage cheese (low-fat) with sliced fruit',
          'Orange slices',
          'Edamame (unsalted)',
        ],
      },
    ],
    evidence: [
      {
        title: 'DASH-Sodium Trial',
        source: 'Sacks et al., New England Journal of Medicine',
        note: 'DASH diet reduced blood pressure significantly, especially in hypertensive individuals; combined with sodium restriction, effects were amplified',
        url: 'https://doi.org/10.1056/NEJM200101043440101',
      },
      {
        title: 'DASH diet and cardiovascular health: meta-analysis',
        source: 'Saneei et al., American Journal of Hypertension',
        note: 'DASH diet reduces the risk of cardiovascular disease, stroke and heart failure',
        url: 'https://doi.org/10.1093/ajh/hpu053',
      },
      {
        title: 'Long-term adherence to DASH diet',
        source: 'Appel et al., Journal of the American College of Cardiology',
        note: 'Even partial adherence to DASH principles provides cardiovascular benefits',
        url: 'https://doi.org/10.1016/j.jacc.2014.03.031',
      },
    ],
  },
  {
    id: 'mediterranean',
    title: 'Mediterranean Diet',
    summary: 'Inspired by traditional eating patterns of Mediterranean countries. Rich in olive oil, nuts, fish, vegetables, fruits, whole grains, and moderate wine. Associated with exceptional longevity and heart health.',
    tags: ['heart-health', 'longevity', 'whole-foods', 'moderate-fat', 'balanced', 'research-backed'],
    mealsPerDay: 3,
    snacksPerDay: 2,
    macroRangesPercent: {
      protein: 18,
      carbs: 42,
      fat: 40,
    },
    mealStructure: [
      {
        meal: 'Breakfast',
        goal: 'Olive oil, whole grains and fruit; moderate protein',
        examples: [
          'Whole grain toast with olive oil and avocado; side of tomatoes',
          'Greek yogurt with honey, walnuts and figs',
          'Scrambled eggs with spinach and feta in olive oil',
          'Fresh fruit salad with unsweetened yogurt and handful of almonds',
        ],
      },
      {
        meal: 'Lunch',
        goal: 'Abundant vegetables, olive oil-based dressings, fish or beans',
        examples: [
          'Large Greek salad with tomatoes, cucumber, olives, feta and olive oil; side of whole grain bread',
          'Grilled sardines or mackerel with salad and roasted vegetables; drizzled with olive oil',
          'Lentil soup with vegetables, herbs and olive oil; whole grain bread on the side',
          'Chickpea salad with diced vegetables, parsley, lemon-olive oil dressing and feta',
        ],
      },
      {
        meal: 'Dinner',
        goal: 'Lean protein (fish/poultry) or plant-based; vegetables cooked with olive oil',
        examples: [
          'Grilled fish (salmon, sea bass, cod) with ratatouille; cooked in olive oil',
          'Chicken breast (grilled or baked) with roasted vegetables and olive oil; orzo side',
          'Whole wheat pasta with marinara, vegetables, olive oil and feta; small portion of grilled fish',
          'Baked cod with lemon, herbs and capers; served with pilaf with olive oil and pine nuts',
        ],
      },
      {
        meal: 'Snack 1',
        goal: 'Nuts, fruit or dairy; supports monounsaturated fat intake',
        examples: [
          'Handful of nuts (walnuts, almonds, pistachios)',
          'Greek yogurt with a drizzle of honey',
          'Sliced fruit (apple, pear, fig)',
          'A small portion of cheese with whole grain crackers',
        ],
      },
      {
        meal: 'Snack 2',
        goal: 'Olives, avocado or additional fruit',
        examples: [
          'Small bowl of olives',
          'Avocado with lemon juice and herbs',
          'Seasonal fruit',
          'Hummus with vegetable sticks and a small portion of pita',
        ],
      },
    ],
    evidence: [
      {
        title: 'PREDIMED Trial',
        source: 'Estruch et al., New England Journal of Medicine',
        note: 'Mediterranean diet with extra-virgin olive oil or nuts reduced cardiovascular events by approximately 30% in high-risk individuals',
        url: 'https://doi.org/10.1056/NEJMoa1200303',
      },
      {
        title: 'Mediterranean diet and mortality meta-analysis',
        source: 'Sofi et al., British Medical Journal',
        note: 'Mediterranean diet is associated with reduced all-cause mortality, cardiovascular mortality and cancer incidence',
        url: 'https://doi.org/10.1136/bmj.b1344',
      },
      {
        title: 'Mediterranean diet and type 2 diabetes',
        source: 'Esposito et al., Diabetologia',
        note: 'Mediterranean diet is associated with better glycemic control and reduced risk of type 2 diabetes',
        url: 'https://doi.org/10.1007/s00125-010-1708-0',
      },
    ],
  },
  {
    id: 'training-high-protein',
    title: 'Training High-Protein',
    summary: 'Optimized for athletes and regular exercisers aiming to build or maintain muscle. Higher protein intake supports recovery and muscle protein synthesis. Includes pre- and post-workout nutrition strategies.',
    tags: ['protein', 'muscle-building', 'training', 'recovery', 'athletes', 'strength-training', 'endurance'],
    mealsPerDay: 4,
    snacksPerDay: 1,
    macroRangesPercent: {
      protein: 35,
      carbs: 40,
      fat: 25,
    },
    mealStructure: [
      {
        meal: 'Breakfast',
        goal: '20-30g protein to support muscle protein synthesis; carbohydrates for energy',
        examples: [
          'Greek yogurt (1 cup) with protein powder (30g) mixed in, berries and a drizzle of honey',
          'Eggs (3) with oatmeal and nuts; includes about 20g protein from eggs',
          'Protein smoothie: whey or casein (30g), banana, spinach, almond milk',
          'Whole grain toast with peanut butter (protein-rich topping) and eggs (2)',
        ],
      },
      {
        meal: 'Lunch',
        goal: 'Balanced meal with lean protein and complex carbohydrates',
        examples: [
          'Grilled chicken breast (6 oz) with quinoa, roasted vegetables and a drizzle of olive oil (approximately 40g protein plus carbs)',
          'Salmon or tuna (6 oz) over mixed greens with vinaigrette; whole grain bread side',
          'Turkey or tofu stir-fry with vegetables and brown rice',
          'Beef or turkey meatballs (6 oz) with marinara and whole wheat pasta; side of steamed vegetables',
        ],
      },
      {
        meal: 'Pre-Workout Snack',
        goal: 'Fuel workout with moderate carbs and protein; consumed 1-2 hours before',
        examples: [
          'Banana with a scoop of peanut butter or almond butter',
          'Greek yogurt with fruit; carbohydrate-protein balance',
          'Whole grain toast with hummus',
          'Oatmeal with protein powder and berries',
        ],
      },
      {
        meal: 'Post-Workout Meal',
        goal: 'Support recovery with 20-30g protein within 2 hours; carbohydrates replenish glycogen',
        examples: [
          'Grilled chicken breast (6 oz) with sweet potato and vegetables',
          'Salmon with brown rice and steamed broccoli',
          'Protein shake (whey or plant-based, 30g) with banana; for quick recovery',
          'Eggs (3) with toast and fruit; can be easier on the stomach immediately after training',
        ],
      },
      {
        meal: 'Dinner',
        goal: 'Substantial protein with vegetables and controlled carbohydrates',
        examples: [
          'Lean beef or grass-fed beef (6 oz) with roasted vegetables and cauliflower rice',
          'Chicken or turkey (6 oz) stir-fry with mixed vegetables over brown rice',
          'Baked cod or white fish with vegetables and a small portion of quinoa',
          'Tofu or tempeh (6 oz equivalent) stir-fry with vegetables and brown rice',
        ],
      },
      {
        meal: 'Evening Snack (optional)',
        goal: 'Slow-digesting protein to support overnight recovery; if needed',
        examples: [
          'Greek yogurt with a small portion of nuts (casein protein is slow-digesting)',
          'Cottage cheese with berries',
          'Handful of nuts or peanut butter (protein and healthy fats)',
        ],
      },
    ],
    evidence: [
      {
        title: 'Optimal protein intake for muscle protein synthesis',
        source: 'Morton et al., British Journal of Nutrition',
        note: 'Training adults need approximately 1.6-2.2 g of protein per kg body weight per day, distributed across meals with about 20-30g per meal to maximize muscle protein synthesis',
        url: 'https://doi.org/10.1017/S0007114517000939',
      },
      {
        title: 'Timing of protein intake for muscle hypertrophy',
        source: 'Schoenfeld & Aragon, Journal of the International Society of Sports Nutrition',
        note: 'Even protein distribution across meals is more important than post-workout timing; total daily protein intake is the primary factor',
        url: 'https://doi.org/10.1186/s12970-018-0205-8',
      },
      {
        title: 'Protein requirements for strength training',
        source: 'Phillips & Van Loon, Sports Medicine',
        note: 'Strength training increases dietary protein requirements; sedentary individuals need about 0.8 g/kg while strength-trained individuals need 1.2-1.7 g/kg daily',
        url: 'https://doi.org/10.1007/s40279-011-0026-2',
      },
    ],
  },
];
