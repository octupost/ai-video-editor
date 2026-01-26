# Supabase Edge Functions - Grid Image Workflow

## Overview

This workflow generates a grid image containing multiple scene frames, then splits it into individual images for each scene. It uses two edge functions:

1. **`start-workflow`** - Initializes the project and triggers grid image generation
2. **`webhook`** - Handles async responses from external AI services

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `grid_images` | Stores grid image metadata and generation status |
| `scenes` | Stores individual scene information |
| `first_frames` | Stores the first frame image for each scene |
| `voiceovers` | Stores voiceover text for each scene |

### `grid_images` Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | Reference to project |
| `rows` | int | Number of rows in the grid |
| `cols` | int | Number of columns in the grid |
| `cell_width` | int | Width of each cell (4096 / cols) |
| `cell_height` | int | Height of each cell (4096 / rows) |
| `url` | text | URL of the generated grid image |
| `prompt` | text | Prompt used for generation |
| `status` | text | Current status |
| `request_id` | text | External API request ID (for tracing) |
| `error_message` | text | Error type when status = 'failed' |

> **Note:** The total grid image is always **4096x4096**. The `cell_width` and `cell_height` are the dimensions of each individual cell extracted from the grid.

### `first_frames` Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `scene_id` | uuid | Reference to scene |
| `visual_prompt` | text | Prompt describing the visual |
| `url` | text | URL of the padded image |
| `resized_url` | text | URL of the scaled/resized image |
| `status` | text | Current status |
| `error_message` | text | Error type when status = 'failed' |

### Error Message Types

Simple error categories for debugging:

**For `grid_images`:**

| Error Message | When to use |
|---------------|-------------|
| `request_error` | Failed to send request to external API |
| `generation_error` | External API returned an error |
| `internal_error` | Unexpected error in our code |

**For `first_frames`:**

| Error Message | When to use |
|---------------|-------------|
| `split_error` | Grid split API failed |
| `internal_error` | Unexpected error in our code |

### Status Values

All status fields use these values:
- `pending` - Waiting to be processed
- `processing` - Currently being processed
- `success` - Completed successfully
- `failed` - Failed with error

---

## Edge Function 1: `start-workflow`

### Purpose
Initialize a new project by creating database records and triggering AI image generation.

### Input

```json
{
  "project_id": "uuid-string",
  "grid_image_prompt": "A cinematic scene of a forest at sunset...",
  "number_of_scenes": 4,
  "voiceover_list": [
    "The sun sets over the ancient forest.",
    "Birds fly across the golden sky.",
    "A deer emerges from the shadows.",
    "Night begins to fall."
  ],
  "visual_prompt_list": [
    "Wide shot of forest with setting sun",
    "Birds silhouettes against orange sky",
    "Deer in forest clearing, golden hour",
    "Forest transitioning to twilight"
  ],
  "width": 1920,
  "height": 1080
}
```

### Flow

#### Step 1: Calculate Grid Dimensions

Calculate rows, columns, and cell sizes based on `number_of_scenes`:

| Scenes | Rows | Cols | Cell Width | Cell Height |
|--------|------|------|------------|-------------|
| 4 | 2 | 2 | 2048 | 2048 |
| 9 | 3 | 3 | 1365 | 1365 |
| 16 | 4 | 4 | 1024 | 1024 |
| 36 | 6 | 6 | 682 | 682 |

> **Note:** The generated grid image is always **4096x4096**. The `cell_width` and `cell_height` represent the size of each individual cell within the grid.

Formula:
```
cols = ceil(sqrt(number_of_scenes))
rows = ceil(number_of_scenes / cols)
cell_width = floor(4096 / cols)
cell_height = floor(4096 / rows)
```

#### Step 2: Insert Grid Image Record

```sql
INSERT INTO grid_images (project_id, rows, cols, cell_width, cell_height, status)
VALUES ($project_id, $rows, $cols, $cell_width, $cell_height, 'pending')
RETURNING id as grid_image_id;
```

#### Step 3: Send Generation Request

**Endpoint:** `fal-ai/nano-banana-pro`

**Request Body:**
```json
{
  "prompt": "<grid_image_prompt from input>",
  "num_images": 1,
  "aspect_ratio": "1:1",
  "output_format": "png",
  "resolution": "4K"
}
```

**Webhook Configuration:**
```json
{
  "webhook_url": "https://<project>.supabase.co/functions/v1/webhook",
  "webhook_data": {
    "step": "GenGridImage",
    "grid_image_id": "<inserted_grid_image_id>",
    "width": 1920,
    "height": 1080,
    "cell_width": 2048,
    "cell_height": 2048,
    "rows": 2,
    "cols": 2
  }
}
```

#### Step 4: Handle Request Response

**If request fails to send:**
```sql
UPDATE grid_images
SET status = 'failed',
    error_message = 'request_error'
WHERE id = $grid_image_id;
```
→ Return error response

**If request sent successfully:**
```sql
UPDATE grid_images
SET status = 'processing', request_id = $request_id
WHERE id = $grid_image_id;
```

#### Step 5: Create Scene Records

For each scene (i = 0 to number_of_scenes - 1):

```sql
-- Insert scene
INSERT INTO scenes (project_id, grid_image_id, "order")
VALUES ($project_id, $grid_image_id, $i)
RETURNING id as scene_id;

-- Insert first_frame (status = processing, will be updated by webhook)
INSERT INTO first_frames (scene_id, visual_prompt, status)
VALUES ($scene_id, $visual_prompt_list[i], 'processing');

-- Insert voiceover (status = success, no processing needed yet)
INSERT INTO voiceovers (scene_id, text, status)
VALUES ($scene_id, $voiceover_list[i], 'success');
```

### Output

**Success Response:**
```json
{
  "success": true,
  "grid_image_id": "abc123",
  "request_id": "fal-request-xyz",
  "scenes_created": 4
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Failed to send generation request",
  "grid_image_id": "abc123"
}
```

---

## Edge Function 2: `webhook`

Handles async callbacks from AI services. Routes to different handlers based on the `step` parameter.

### Webhook Payload Structure

```json
{
  "status": "OK" | "ERROR",
  "payload": { ... },
  "request_id": "fal-request-xyz",
  "webhook_data": {
    "step": "GenGridImage" | "SplitGridImage",
    "grid_image_id": "abc123",
    ...
  }
}
```

---

### Handler: `GenGridImage`

Triggered when the grid image generation completes.

#### Input (webhook_data)

```json
{
  "step": "GenGridImage",
  "grid_image_id": "abc123",
  "width": 1920,
  "height": 1080,
  "cell_width": 2048,
  "cell_height": 2048,
  "rows": 2,
  "cols": 2
}
```

#### Payload on Success

```json
{
  "images": [
    {
      "url": "https://fal.media/files/.../generated_grid.png",
      "content_type": "image/png"
    }
  ],
  "prompt": "A cinematic scene of a forest..."
}
```

#### Flow

**If generation failed:**
```sql
UPDATE grid_images
SET status = 'failed',
    error_message = 'generation_error'
WHERE id = $grid_image_id;
```
→ Return error response

**If generation succeeded:**

##### Step 1: Update Grid Image Record
```sql
UPDATE grid_images
SET status = 'success',
    url = $payload.images[0].url,
    prompt = $payload.prompt
WHERE id = $grid_image_id;
```

##### Step 2: Send Split Request

**Endpoint:** `comfy/octopost/splitgridimage`

**Request Body:**
```json
{
  "loadimage_1": "<url from generation response>",
  "rows": 2,
  "cols": 2,
  "width": 1920,
  "height": 1080,
  "cell_width": 2048,
  "cell_height": 2048
}
```

**Webhook Configuration:**
```json
{
  "webhook_url": "https://<project>.supabase.co/functions/v1/webhook",
  "webhook_data": {
    "step": "SplitGridImage",
    "grid_image_id": "abc123"
  }
}
```

---

### Handler: `SplitGridImage`

Triggered when the grid image split completes.

#### Input (webhook_data)

```json
{
  "step": "SplitGridImage",
  "grid_image_id": "abc123"
}
```

#### Payload on Success

The response contains two output nodes:
- Node `11`: Padded images (original aspect ratio with padding)
- Node `26`: Scaled/resized images (fit to target dimensions)

```json
{
  "outputs": {
    "11": {
      "images": [
        {
          "filename": "outpadded_image_00001_.png",
          "url": "https://fal.media/files/.../outpadded_image_00001_.png"
        },
        {
          "filename": "outpadded_image_00002_.png",
          "url": "https://fal.media/files/.../outpadded_image_00002_.png"
        }
      ]
    },
    "26": {
      "images": [
        {
          "filename": "scaled_image_00001_.png",
          "url": "https://fal.media/files/.../scaled_image_00001_.png"
        },
        {
          "filename": "scaled_image_00002_.png",
          "url": "https://fal.media/files/.../scaled_image_00002_.png"
        }
      ]
    }
  }
}
```

#### Flow

##### Step 1: Fetch Scenes in Order

```sql
SELECT s.id as scene_id, s."order", ff.id as first_frame_id
FROM scenes s
JOIN first_frames ff ON ff.scene_id = s.id
WHERE s.grid_image_id = $grid_image_id
ORDER BY s."order" ASC;
```

##### Step 2: Update First Frames

**If generation failed:**
```sql
UPDATE first_frames
SET status = 'failed',
    error_message = 'split_error'
WHERE scene_id IN (SELECT id FROM scenes WHERE grid_image_id = $grid_image_id);
```

**If generation succeeded:**

For each scene (matching by order/index):
```sql
UPDATE first_frames
SET url = $outputs["11"].images[i].url,
    resized_url = $outputs["26"].images[i].url,
    status = 'success'
WHERE id = $first_frame_id;
```

> **Note:** The image order in the response matches the scene order (0-indexed).

---

## Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         start-workflow                               │
├─────────────────────────────────────────────────────────────────────┤
│  1. Calculate grid dimensions (rows, cols)                          │
│  2. INSERT into grid_images (status: pending)                       │
│  3. Send request to fal-ai/nano-banana-pro                          │
│  4. UPDATE grid_images (status: processing)                         │
│  5. INSERT scenes, first_frames, voiceovers                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   fal-ai generates      │
                    │   4K grid image         │
                    └─────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    webhook (step: GenGridImage)                      │
├─────────────────────────────────────────────────────────────────────┤
│  1. UPDATE grid_images with url (status: success)                   │
│  2. Send request to comfy/splitgridimage                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │   ComfyUI splits grid   │
                    │   into individual imgs  │
                    └─────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   webhook (step: SplitGridImage)                     │
├─────────────────────────────────────────────────────────────────────┤
│  1. Fetch scenes by grid_image_id (ordered)                         │
│  2. UPDATE first_frames with url + resized_url (status: success)    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                         ✅ Workflow Complete
```

---

## Error Handling Summary

| Step | Error Condition | Table | error_message |
|------|-----------------|-------|---------------|
| start-workflow | Failed to send generation request | `grid_images` | `request_error` |
| GenGridImage webhook | External API returned error | `grid_images` | `generation_error` |
| SplitGridImage webhook | Split API failed | `first_frames` | `split_error` |
| Any step | Unexpected error in code | varies | `internal_error` |

> **Tip:** Use the `request_id` column to trace errors back to the external API (fal.ai) for more details.

---

## Environment Variables

```env
FAL_API_KEY=your-fal-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
