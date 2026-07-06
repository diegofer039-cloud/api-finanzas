# API Finanzas Personales

API REST para gestionar ingresos y gastos personales. Construida con **FastAPI** y **SQLite**.

## Endpoints

| Método | Ruta                          | Descripción               |
|--------|-------------------------------|---------------------------|
| POST   | `/transactions/`              | Crear transacción         |
| GET    | `/transactions/`              | Listar transacciones      |
| GET    | `/transactions/{id}`          | Obtener una transacción   |
| PUT    | `/transactions/{id}`          | Actualizar transacción    |
| DELETE | `/transactions/{id}`          | Eliminar transacción      |
| GET    | `/transactions/summary/monthly?year=2026` | Resumen mensual |

## Cómo ejecutar

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Abrir `http://localhost:8000/docs` para ver Swagger.
