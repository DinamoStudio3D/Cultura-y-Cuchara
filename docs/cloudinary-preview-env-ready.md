# Cloudinary Preview environment

Preview configuration for `feature/cloudinary-images` is ready for validation.

Required Vercel environment variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_PRESET`

This marker commit intentionally contains no production/runtime behavior changes. It exists to trigger a fresh Preview deployment after the branch-scoped environment variables were configured.
