curl -X POST 'https://lmounotqnrspwuvcoemk.supabase.co/functions/v1/start-workflow' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb3Vub3RxbnJzcHd1dmNvZW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjAzODMsImV4cCI6MjA4MzMzNjM4M30.DVNymJQOpWLH61EVXrf7cieCVtb-AfUmTOeauW3o-YY' \
  -d '{
    "project_id": "a091f70e-8874-464e-acad-e263ffa3bcf1",
    "grid_image_prompt": "A 2x3 grid of 6 panels showing a mountain adventure story. Top row left to right: (1) sunrise over misty mountains with golden light, (2) hiker on a forest trail with tall pine trees, (3) crystal clear river flowing through a valley. Bottom row left to right: (4) snow-capped peaks against blue sky, (5) wildflower meadow with colorful blooms, (6) dramatic sunset with orange and purple clouds over mountain silhouette. Cinematic photography style, consistent color grading.",
    "rows": 2,
    "cols": 3,
    "voiceover_list": ["Scene 1 narration", "Scene 2 narration", "Scene 3 narration", "Scene 4 narration", "Scene 5 narration", "Scene 6 narration"],
    "visual_prompt_list": ["Mountain sunrise", "Forest path", "River valley", "Snow peaks", "Meadow flowers", "Sunset view"],
    "width": 1920,
    "height": 1080
  }'
