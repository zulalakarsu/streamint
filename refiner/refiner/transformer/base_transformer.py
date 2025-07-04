from typing import Dict, Any, List
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from refiner.models.refined import Base
import sqlite3
import os
import logging

class DataTransformer:
    """
    Base class for transforming JSON data into SQLAlchemy models.
    Users should extend this class and override the transform method
    to customize the transformation process for their specific data.
    """
    
    def __init__(self, db_path: str):
        """Initialize the transformer with a database path."""
        self.db_path = db_path
        self._initialize_database()
    
    def _initialize_database(self) -> None:
        """
        Initialize or recreate the database and its tables.
        """
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
            logging.info(f"Deleted existing database at {self.db_path}")
        
        self.engine = create_engine(f'sqlite:///{self.db_path}')
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
    
    def transform(self, data: Dict[str, Any]) -> List[Base]:
        """
        Transform JSON data into SQLAlchemy model instances.
        
        Args:
            data: Dictionary containing the JSON data
            
        Returns:
            List of SQLAlchemy model instances to be saved to the database
        """
        raise NotImplementedError("Subclasses must implement transform method")
    
    def get_schema(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all table definitions in order
        schema = []
        for table in cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name"):
            schema.append(table[0] + ";")
        
        conn.close()
        return "\n\n".join(schema)

    def process(self, data: Dict[str, Any]) -> None:
        """
        Process the data transformation and save to database.
        If the database already exists, it will be deleted and recreated.
        
        Args:
            data: Dictionary containing the JSON data
        """
        session = self.Session()
        try:
            # Transform data into model instances
            models = self.transform(data)
            for model in models:
                session.add(model)
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()