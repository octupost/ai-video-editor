instructions = """
You are a helpful assistant that generates scenes for a video project.
We are going to create a video like dmac kinda youtbe short by using Avatar and Hero Images and Voiceover Text.
Here are the instructions for the scenes:
- The video will consist of Avatar, Hero Images, B-Roll Images, 
- We will have 2 main visual types:
- 1. halfHalf: At the bottom half of the screen we will have our avatar and on top we will have hero images.
- 2. fullImage: We will have a full image on the screen.
- This scene type will be decided depding on the importance of the picture and the voiceover text and the 
scene we will leave it to you but in generatl we want 20 percent full image 80 percent half half.
- How to define hero images: In one scene we can have multiple hero images that comes one after another 

{
  "scene_id": "1000",
  "type": "hook",
  "script_segment": "Did you know that 90% of startups fail?",
  "start_time": 0,
  "end_time": 5.2,
}

"""

scenes_data = { 
  "voiceover_text": "this best 11 of Real Madrid players who left the club to become world class is surprising starting in goal Santiago karez the Spaniard left Madrid twice then became a Valencia Legend left back Teo Hernandez deemed Surplus to requirement at Madrid and is now Milan's star fullback left Center back Walter Samuel he signed for 25 mil but departed for inter The Following season right center back forino now I know he's not a CB but he's played there previously and I had to include it right back Ashraf hakeim he departed for 43 mil decent money but they still missed out big time CDM the obvious pick is Claude Mele but I think he was world class before Madrid sold to Chelsea so instead estan can be Uso my two attacking mids pure class Wesley Snider and Martin odard right wing Arian Robin this guy was always destined for greatness by and struck gold left wing Juan Mata yes he's more of a 10 but played on the left during his casaes and Striker Samuel letto he left Madrid and achieved greatness with Barca and Inter what a team",
  "music_prompt": "",
  "scenes": [
    {
      "scene_id": "1000",
      "type": "hook",
      "script_segment": "Did you know that 90% of startups fail?",
      "start_time": 0,
      "end_time": 5.2,
      "avatar": {
        "visible": True,
        "position": "bottom-right",
        "size": "small"
      },  
      "hero_image": {
        "prompt": "Dramatic startup failure, office with empty desks",
        "style": "cinematic",
        "animation": "ken-burns-zoom-in"
      }
    },
    {
      "scene_id": "2000", 
      "type": "problem",
      "script_segment": "The main reason? They run out of cash.",
      "start_time": 5.2,
      "end_time": 9.8,
      
      "avatar": {
        "visible": true,
        "position": "bottom-right",
        "size": "small"
      },
      
      "hero_image": {
        "prompt": "Empty wallet, burning money, financial crisis",
        "style": "cinematic",
        "animation": "slow-zoom-out"
      }
    }
  ]
}

print(scenes)