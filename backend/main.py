from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import reviews, posts, reservations, stocks
from api.routes import google_reviews, meta_publish, public_booking

app = FastAPI(
    title="GLG AI API",
    description="Agents IA pour la restauration — GLG AI",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        # Production — updated after Vercel deploy
        "https://le5.glg-ai.com",
        "https://glg-ai.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reviews.router)
app.include_router(posts.router)
app.include_router(reservations.router, prefix="/reservations", tags=["reservations"])
app.include_router(public_booking.router, prefix="/reservations", tags=["public-booking"])
app.include_router(stocks.router)
app.include_router(google_reviews.router)
app.include_router(meta_publish.router)


@app.get("/")
def root():
    return {"status": "ok", "app": "GLG AI API", "version": "0.1.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
