# GPT-Image-2 Image Editing Design

## Purpose

Add an official-style image editing flow to the existing image studio. Users should be able to edit a generated image from the result card, describe the change in natural language, optionally paint the area that should be changed, and submit the edit through the APIyi-compatible `gpt-image-2` image edits endpoint.

## Product Flow

Generated image cards gain an `Edit` action near the image, similar to the official ChatGPT image UI. Selecting it opens a focused full-screen editing view instead of adding more controls to the existing left panel.

The editing view contains:

- A top toolbar with back, title, undo, redo, aspect ratio, download, and overflow actions.
- A centered image stage that displays the selected image at a stable scale.
- A selection mode with a brush cursor and a semi-transparent blue overlay.
- A bottom prompt composer with placeholder text such as `Describe edit`.
- A primary submit action that sends either whole-image editing or masked inpainting.

The user can submit a text-only edit without painting. If they paint over the image, the painted area becomes the region to redraw.

## Mask Behavior

The browser creates a mask from the painted selection. The mask must match the source image dimensions and be sent as a PNG with an alpha channel.

The API expects transparent pixels to mark the redraw area and opaque pixels to mark preserved content. The editor therefore exports:

- Painted pixels: `alpha = 0`
- Unpainted pixels: `alpha = 255`

The blue overlay is only a UI affordance and is not sent as the mask image.

## API Design

Add a new server route:

`POST /api/images/edit`

The route accepts `multipart/form-data` from the client and forwards a compatible multipart request to:

`POST https://api.apiyi.com/v1/images/edits`

Fields:

- `model`: fixed to `gpt-image-2`
- `prompt`: required edit instruction
- `image[]`: required reference image, initially one image from the selected generated result
- `mask`: optional PNG mask generated from brush selection
- `size`: existing size option
- `quality`: `high` by default
- `output_format`: selected output format
- `background`: `auto` or `opaque`

The route must not send `input_fidelity` because `gpt-image-2` rejects it. `background: transparent` is not offered for edits.

The upstream response contains plain base64 in `data[0].b64_json`. The route converts it to a browser-ready data URL using the selected output format and returns the same shape as existing image generation responses where practical.

## Data And History

Extend stored sessions with a lightweight operation type so the UI can distinguish generated images from edited images:

- `operation: "generate" | "edit"`
- `sourceImageId` for edited sessions when available
- `referenceImageCount` for future multi-image editing support

Edited results appear in the existing chat/result area and history rail. The result pills should show `Image edit`, size, quality, format, and whether a mask was used.

The edited output can be used as the next source image, enabling multi-round refinement.

## Component Boundaries

Keep the editor in focused components:

- `ImageEditWorkspace`: full-screen editing shell and state orchestration.
- `EditImageStage`: image display, pointer handling, and selection overlay.
- `EditComposer`: prompt input and submit action.
- `image-edit-mask` helper: converts brush strokes into an API-compatible mask blob.
- `image-edit-options` helper: validates server-side edit fields and file constraints.

The existing generation form remains responsible for text-to-image generation only.

## Validation And Errors

Client-side validation:

- Prompt is required.
- An editable source image is required.
- Mask submission is optional.
- Brush tools are disabled until the source image has loaded.

Server-side validation:

- Prompt must be non-empty.
- At least one `image[]` file is required.
- Maximum 16 reference images.
- Accepted image formats: PNG, JPEG, WebP.
- Mask, when present, must be an image file and is forwarded only for the first image.
- Output compression is allowed only for JPEG/WebP.

User-facing errors should follow the current Chinese error style and avoid exposing raw SDK objects.

## Testing

Add tests for:

- Edit option parsing and defaults.
- Rejection of empty prompt and missing image.
- Maximum image count enforcement.
- Multipart forwarding field names, especially repeated `image[]`.
- Mask forwarding and no-mask whole-image editing.
- Base64 response normalization into data URLs.
- Existing generation behavior staying unchanged.

Manual browser verification should cover:

- Edit button opens the full-screen editor from a generated result.
- Text-only edit can submit.
- Brush painting draws the blue overlay.
- The exported mask uses transparent painted pixels.
- Edited result appears in the result view/history and can be downloaded.
