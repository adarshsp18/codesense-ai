import asyncio
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from openai import APIError
from app.curriculum import PROJECT
from app.models import AssessmentResponse, ConceptQuestion, CustomExplanationRequest, CustomHintRequest, CustomQuestionRequest, CustomReviewRequest, CustomReviewResponse, ExplanationRequest, HintRequest, HintResponse, RoadmapRequest
from app.services import explanation_service, mentor_service, provider, review_service, roadmap_service
from app.services.project_idea import PROJECT_IDEA_MESSAGE, is_web_project_idea

load_dotenv(Path(__file__).resolve().parents[1] / '.env', override=False)
app = FastAPI(title='CodeSense AI', version='0.1.0')
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', '[::1]', 'testserver'])
# No CORS middleware: extension-host requests need none. Reject browser-origin POSTs.
gate = asyncio.Semaphore(2)

@app.middleware('http')
async def local_only(request: Request, call_next):
    if request.method == 'POST' and request.headers.get('origin'):
        return JSONResponse(status_code=403, content={'error': {'code': 'browser_origin', 'message': 'Browser-origin API writes are disabled.'}})
    length = request.headers.get('content-length', '0')
    if not length.isdigit() or int(length) > 40000:
        return JSONResponse(status_code=413, content={'error': {'code': 'too_large', 'message': 'Request exceeds the demo limit.'}})
    return await call_next(request)

@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    if request.url.path == '/roadmap/generate' and any(error.get('loc') and error['loc'][-1] == 'idea' for error in exc.errors()):
        return JSONResponse(status_code=422, content={'error': {'code': 'invalid_request', 'message': PROJECT_IDEA_MESSAGE}})
    return JSONResponse(status_code=422, content={'error': {'code': 'invalid_request', 'message': 'Check required fields, supported milestone IDs, and input lengths.'}})

@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse(status_code=exc.status_code, content={'error': {'code': 'not_available', 'message': str(exc.detail)}})

async def guarded(call):
    try:
        async with asyncio.timeout(35):
            async with gate:
                return await call()
    except provider.AIUnavailable as exc:
        raise HTTPException(503, str(exc)) from None
    except TimeoutError:
        raise HTTPException(504, 'AI request timed out. Retry or continue offline.') from None
    except provider.AIServiceError as exc:
        raise HTTPException(502, str(exc)) from None
    except (APIError, ValueError):
        raise HTTPException(502, 'AI service unavailable or returned an invalid response. Retry or continue offline.') from None

@app.get('/health')
async def health():
    return {'status': 'ok', 'version': '0.1.0', 'ai_configured': provider.configured(), 'offline_guided_available': True}

@app.get('/guided-projects')
async def projects():
    return {'projects': [{'id': PROJECT['id'], 'title': PROJECT['title'], 'implemented_milestones': len(PROJECT['milestones'])}]}

@app.get('/guided-projects/{project_id}')
async def project(project_id: str):
    if project_id != 'todo':
        raise HTTPException(404, 'Guided project not found.')
    return PROJECT

@app.post('/roadmap/generate')
async def roadmap(request: RoadmapRequest):
    if not is_web_project_idea(request.idea):
        raise HTTPException(422, PROJECT_IDEA_MESSAGE)
    return await guarded(lambda: roadmap_service.roadmap(request))

@app.post('/mentor/hint', response_model=HintResponse)
async def hint(request: HintRequest | CustomHintRequest):
    return await guarded(lambda: mentor_service.hint(request))

@app.post('/learning/evaluate', response_model=AssessmentResponse)
async def evaluate(request: ExplanationRequest | CustomExplanationRequest):
    return await guarded(lambda: explanation_service.evaluate(request))


@app.post('/learning/question', response_model=ConceptQuestion)
async def question(request: CustomQuestionRequest):
    return explanation_service.question(request)


@app.post('/mentor/review', response_model=CustomReviewResponse)
async def review(request: CustomReviewRequest):
    return await guarded(lambda: review_service.review(request))
