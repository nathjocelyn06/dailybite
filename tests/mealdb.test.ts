import { describe, expect, it } from "vitest";
import { estimate, parseMeal, splitSteps, youtubeId } from "@/lib/mealdb";

describe("youtubeId", () => {
  it("reads watch, short and embed links", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=1IszT_guI08")).toBe("1IszT_guI08");
    expect(youtubeId("https://youtu.be/1IszT_guI08")).toBe("1IszT_guI08");
    expect(youtubeId("https://www.youtube.com/embed/1IszT_guI08")).toBe("1IszT_guI08");
    expect(youtubeId("")).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });
});

describe("parseMeal", () => {
  it("collects ingredients, steps, video and estimates", () => {
    const r = parseMeal({
      idMeal: "52772",
      strMeal: "Teriyaki Chicken Casserole",
      strCategory: "Chicken",
      strArea: "Japanese",
      strInstructions: "Preheat oven.\r\nCombine sauce.\r\n\r\nBake 20 minutes.",
      strMealThumb: "https://www.themealdb.com/images/media/meals/x.jpg",
      strYoutube: "https://www.youtube.com/watch?v=4aZr5hZXP_s",
      strTags: "Meat,Casserole",
      strIngredient1: "soy sauce",
      strMeasure1: "3/4 cup",
      strIngredient2: "water",
      strMeasure2: "1/2 cup",
      strIngredient3: "",
      strMeasure3: " ",
      strIngredient4: null
    });
    expect(r.external_id).toBe("52772");
    expect(r.ingredients).toEqual([
      { name: "soy sauce", measure: "3/4 cup" },
      { name: "water", measure: "1/2 cup" }
    ]);
    expect(r.step_list).toHaveLength(3);
    expect(r.youtube_id).toBe("4aZr5hZXP_s");
    expect(r.tags).toEqual(["Meat", "Casserole"]);
    expect(r.est_difficulty).toBe("Easy");
    expect(r.est_minutes % 5).toBe(0);
  });
});

describe("helpers", () => {
  it("splits numbered steps", () => {
    expect(splitSteps("STEP 1\nChop.\n2. Fry.\n3) Serve")).toEqual(["Chop.", "Fry.", "Serve"]);
  });
  it("difficulty grows with work", () => {
    expect(estimate(5, 3).est_difficulty).toBe("Easy");
    expect(estimate(10, 6).est_difficulty).toBe("Medium");
    expect(estimate(18, 12).est_difficulty).toBe("Hard");
  });
});
