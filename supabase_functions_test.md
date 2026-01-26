curl -X POST 'https://lmounotqnrspwuvcoemk.supabase.co/functions/v1/start-workflow' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb3Vub3RxbnJzcHd1dmNvZW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjAzODMsImV4cCI6MjA4MzMzNjM4M30.DVNymJQOpWLH61EVXrf7cieCVtb-AfUmTOeauW3o-YY" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "a091f70e-8874-464e-acad-e263ffa3bcf1",
    "grid_image_prompt": "A 2x2 grid of cinematic forest scenes: top-left shows sunset through trees, top-right shows birds flying across orange sky, bottom-left shows a deer in golden light, bottom-right shows twilight falling over the forest. Photorealistic, dramatic lighting, 4K quality.",
    "number_of_scenes": 4,
    "voiceover_list": [
      "The sun sets over the ancient forest, casting long shadows through the towering trees.",
      "Birds take flight across the golden sky, their silhouettes dancing against the clouds.",
      "A deer emerges cautiously from the shadows, bathed in warm golden hour light.",
      "As night begins to fall, the forest transforms into a world of mystery and wonder."
    ],
    "visual_prompt_list": [
      "Wide establishing shot of dense forest with setting sun filtering through trees, volumetric lighting",
      "Low angle shot of birds in flight against vibrant orange and pink sunset sky",
      "Medium shot of majestic deer standing in forest clearing during golden hour",
      "Wide shot of forest transitioning from day to twilight, deep blue and purple tones"
    ],
    "width": 1920,
    "height": 1080
  }'


{"success":true,"grid_image_id":"90f7f924-76d1-4b25-914a-cd117da99459","request_id":"a117c53b-6eab-476c-bf20-425202210232","scenes_created":4}%                        
--------
curl -X POST 'https://lmounotqnrspwuvcoemk.supabase.co/functions/v1/start-workflow' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb3Vub3RxbnJzcHd1dmNvZW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjAzODMsImV4cCI6MjA4MzMzNjM4M30.DVNymJQOpWLH61EVXrf7cieCVtb-AfUmTOeauW3o-YY" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "a091f70e-8874-464e-acad-e263ffa3bcf1",
    "grid_image_prompt": "A 2x2 grid showing 4 different cinematic nature scenes in a consistent style",
    "number_of_scenes": 4,
    "voiceover_list": ["Scene 1", "Scene 2", "Scene 3", "Scene 4"],
    "visual_prompt_list": ["Forest sunset", "Birds flying", "Deer in meadow", "Twilight forest"],
    "width": 1920,
    "height": 1080
  }'