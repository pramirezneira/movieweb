const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');
require("dotenv").config();
const { updateServer } = require("./updateServer");
const { restartServer } = require("./restartServer");
const multer = require("multer");
const app = express();
const port = process.env.PORT || 3000;
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Serve static files from the "views" directory
app.use(express.static('views'));

// Conectar a la base de datos SQLite
const db = new sqlite3.Database(process.env.DATABASE != null ? __dirname + process.env.DATABASE : 'C:\\Users\\Pablo\\OneDrive - Universidad Austral\\Bases de Datos y Recursos de Información\\Unidad 5 El lenguaje de consulta SQL\\datagrip\\movies.db');

const users = new sqlite3.Database(__dirname + process.env.USERS);

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Configurar parser de JSON
app.use(express.json());

// Ruta para el login
app.get("/", (req, res) => {
    res.render("login");
});

// Ruta para la página de inicio
app.get('/home', (req, res) => {
    res.render('index');
});

// Ruta para buscar películas
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;

    if (searchTerm == 'xoaco') {
        res.sendFile(__dirname + "/xoaco.png");
        return;
    }
    // Realizar la búsqueda en la base de datos
    db.all(
        `SELECT * 
        FROM movie AS m 
        WHERE m.title LIKE ?;`,
        [`%${searchTerm}%`],
        (err, rows) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            } else {
                db.all(
                    `SELECT DISTINCT person.person_name, person.person_id 
                    FROM movie_crew
                    INNER JOIN person ON person.person_id = movie_crew.person_id
                    WHERE movie_crew.job = 'Director' AND person.person_name LIKE ?;`,
                    [`%${searchTerm}%`],
                    (err2, row2) => {
                        if (err2) {
                            console.error(err2);
                            res.status(500).send('Error en la búsqueda.');
                        }
                        else {
                            db.all(
                                `SELECT DISTINCT person.person_name, person.person_id 
                                FROM movie_cast
                                INNER JOIN person ON person.person_id = movie_cast.person_id
                                WHERE person.person_name LIKE ?;`,
                                [`%${searchTerm}%`],
                                (err3, row3) => {
                                    if (err3) {
                                        console.error(err3);
                                        res.status(500).send('Error en la búsqueda.');
                                    }
                                    else {
                                        res.render('resultado', {
                                            movies: rows,
                                            directors: row2,
                                            actors: row3
                                        });
                                    }
                                }
                            )
                        }
                    }
                )
            }
        }
    );
});

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;

    // Consulta SQL para obtener los datos de la película, elenco y crew
    const movieQuery = `SELECT m.*, l.language_name, c.country_name
    FROM movie AS m
    INNER JOIN movie_languages AS ml
    ON m.movie_id = ml.movie_id
    INNER JOIN language AS l
    ON ml.language_id = l.language_id
    INNER JOIN production_country AS pc
    ON m.movie_id = pc.movie_id
    INNER JOIN country AS c
    ON pc.country_id = c.country_id
    WHERE m.movie_id = ? AND ml.language_role_id = 1;`;

    const castQuery = `SELECT p.*, mca.character_name FROM person AS p
    INNER JOIN movie_cast AS mca
    ON p.person_id = mca.person_id WHERE mca.movie_id = ?
    ORDER BY cast_order;`

    const crewQuery = `SELECT p.*, mcr.job, d.department_name FROM person AS p
    INNER JOIN movie_crew AS mcr
    ON p.person_id = mcr.person_id
    INNER JOIN department AS d
    ON mcr.department_id = d.department_id
    WHERE mcr.movie_id = ?;`;

    const genreQuery = `SELECT g.genre_name FROM genre AS g
    INNER JOIN movie_genres AS mg
    ON g.genre_id = mg.genre_id WHERE mg.movie_id = ?;`;

    const directorQuery = `SELECT p.person_id, p.person_name
    FROM person AS p
    INNER JOIN movie_crew AS mcr
    ON p.person_id = mcr.person_id
    WHERE movie_id = ? AND mcr.job = 'Director';`;

    const writerQuery = `SELECT p.person_id, p.person_name
    FROM person AS p
    INNER JOIN movie_crew AS mcr
    ON p.person_id = mcr.person_id
    WHERE movie_id = ? AND mcr.job = 'Writer';`;

    const keywordQuery = `SELECT k.keyword_name FROM keyword AS k
    INNER JOIN movie_keywords AS mk
    ON k.keyword_id = mk.keyword_id
    INNER JOIN movie AS m
    ON mk.movie_id = m.movie_id
    WHERE m.movie_id = ?;`;

    const companyQuery = `SELECT pc.company_name FROM movie AS m
    INNER JOIN movie_company AS mc
    ON m.movie_id = mc.movie_id
    INNER JOIN production_company AS pc
    ON mc.company_id = pc.company_id
    WHERE m.movie_id = ?;`

    const movieData = {};

    db.all(movieQuery, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send("Error al cargar los datos de la película.");
            return;
        }
        if (rows.length == 0) {
            res.status(404).send("Película no encontrada.");
            return;
        }
        movieData.movie = rows;
        db.all(castQuery, [movieId], (err, rows) => {
            if (err) {
                console.error(err);
                res.status(500).send("Error al cargar los datos de la película.");
                return;
            }
            movieData.cast = rows;
            db.all(crewQuery, [movieId], (err, rows) => {
                if (err) {
                    console.error(err);
                    res.status(500).send("Error al cargar los datos de la película.");
                    return;
                }
                movieData.crew = rows;
                db.all(genreQuery, [movieId], (err, rows) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send("Error al cargar los datos de la película.");
                        return;
                    }
                    movieData.genre = rows;
                    db.all(directorQuery, [movieId], (err, rows) => {
                        if (err) {
                            console.error(err);
                            res.status(500).send("Error al cargar los datos de la película.");
                            return;
                        }
                        movieData.director = rows;
                        db.all(writerQuery, [movieId], (err, rows) => {
                            if (err) {
                                console.error(err);
                                res.status(500).send("Error al cargar los datos de la película.");
                                return;
                            }
                            movieData.writer = rows;
                            db.all(keywordQuery, [movieId], (err, rows) => {
                                if (err) {
                                    console.error(err);
                                    res.status(500).send("Error al cargar los datos de la película.");
                                }
                                movieData.keyword = rows;
                                db.all(companyQuery, [movieId], (err, rows) => {
                                    if (err) {
                                        console.error(err);
                                        res.status(500).send("Error al cargar los datos de la película.");
                                    }
                                    movieData.company = rows;
                                    res.render('pelicula', { movie: movieData });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;

    // Consulta SQL para obtener las películas en las que participó el actor
    const query = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie_cast.character_name as role,
      movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?
    UNION
    SELECT DISTINCT
    person.person_name as actorName,
    movie_crew.job as role,
    movie.*
    FROM movie
    INNER JOIN movie_crew ON movie_crew.movie_id = movie.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job LIKE 'Director' AND movie_crew.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(query, [actorId, actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            // Obtener el nombre del actor
            const actorName = movies.length > 0 ? movies[0].actorName : '';
            const actedMovies = [];
            const directedMovies = [];
            // separo de la consulta las peliculas donde dirigió y donde actuó
            movies.forEach((row) => {
                if (row.role !== 'Director') {
                    actedMovies.push({
                        release_date: row.release_date,
                        movie_id: row.movie_id,
                        title: row.title,
                        role: row.role
                    })
                }
                else {
                    directedMovies.push({
                        release_date: row.release_date,
                        movie_id: row.movie_id,
                        title: row.title,
                        role: row.role
                    })
                }
            })
            res.render('actor', { actorName, directedMovies, actedMovies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director
    const query = `
    SELECT DISTINCT
        person.person_name as directorName,
        movie_crew.job as role,
        movie.*
    FROM movie
    INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?
    UNION
    SELECT DISTINCT
        person.person_name as directorName,
        movie_cast.character_name as role   ,
        movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON movie_cast.person_id = person.person_id
    WHERE movie_cast.person_id = ?;
  `;


    // console.log('query = ', query)

    // Ejecutar la consulta
    db.all(query, [directorId, directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            // console.log('movies.length = ', movies.length)
            // Obtener el nombre del director
            const directorName = movies.length > 0 ? movies[0].directorName : '';
            const actedMovies = [];
            const directedMovies = [];
            movies.forEach((row) => {
                // separo de la consulta las peliculas donde dirigió y donde actuó
                if (row.role !== 'Director') {
                    actedMovies.push({
                        title: row.title,
                        release_date: row.release_date,
                        movie_id: row.movie_id,
                        rol: row.role,
                    })
                }
                else {
                    directedMovies.push({
                        title: row.title,
                        release_date: row.release_date,
                        movie_id: row.movie_id,
                        rol: row.role,
                    })
                }
            })
            res.render('director', { directorName, directedMovies, actedMovies });
        }
    });
});

// Ruta para buscar por palabras clave
app.get("/keyword", (req, res) => {
    res.render(__dirname + "/views/search_keyword.ejs");
});

// Funcion para autocompletar la búsqueda
app.get("/api/autocomplete", (req, res) => {
    const { q } = req.query;
    if (q == undefined) {
        res.status(400).send("Bad Request");
        return;
    }
    const query = `SELECT k.keyword_name FROM keyword AS k
    WHERE k.keyword_name LIKE ? ORDER BY k.keyword_name LIMIT 10;`;
    db.all(query, [`%${q}%`], (err, rows) => {
        if (err) {
            console.log(err);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.status(200).send(rows);
    });
});

// Ruta para visualizar los resultados de la búsqueda por palabras clave
app.get("/keyword/:q", (req, res) => {
    res.status(200).render(__dirname + "/views/resultados_keywords.ejs");
});

// Funcion para buscar por palabras clave
app.get("/api/keyword", (req, res) => {
    const { q } = req.query;
    if (q == undefined) {
        res.status(400).send("Bad Request");
        return;
    }
    const query = `SELECT * FROM movie AS m WHERE m.movie_id
    IN (SELECT m.movie_id FROM movie AS m
    INNER JOIN movie_keywords AS mk ON m.movie_id
    = mk.movie_id INNER JOIN keyword AS k
    ON mk.keyword_id = k.keyword_id WHERE k.keyword_name
    LIKE ?);`;
    db.all(query, [`%${q}%`], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
            return;
        }
        res.status(200).send(rows);
    });
});

app.get("/update", (req, res) => {
    res.render("update");
});

app.post("/api/update", upload.single("zipFile"), async (req, res) => {
    const zipFile = req.file;
    if (!zipFile) {
        res.status(400).send("El nombre no puede estar vacío");
        return;
    }
    try {
        updateServer(zipFile);
        await restartServer();
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

/**
 * @returns {Promise<any[]>}
 */
async function getUsers() {
    return new Promise((resolve, reject) => {
        users.all("SELECT * FROM user", (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

app.get("/api/users", async (req, res) => {
    try {
        const result = await getUsers();
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post("/api/users", async (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.sendStatus(400);
        return;
    }
    try {
        const result = await getUsers();
        if (result.length >= 5) {
            res.sendStatus(403);
            return;
        }
        users.all("INSERT INTO user VALUES (null, ?)", [name], (err, rows) => {
            if (err) {
                console.error(err);
                res.sendStatus(500);
                return;
            }
            res.status(200).send("Usuario agregado");
        });
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.patch("/api/users", (req, res) => {
    const { id, name } = req.body;
    if (id == undefined || !name) {
        res.status(400).send("El nombre no puede estar vacío");
        return;
    }
    users.all("UPDATE user SET name = ? WHERE id = ?", [name, id], (err, rows) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        res.status(200).send("Usuario actualizado");
    });
});

app.delete("/api/users", (req, res) => {
    const { id } = req.body;
    if (id == undefined) {
        res.statusCode(400);
        return;
    }
    users.all("DELETE FROM user WHERE id = ?", [id], (err, rows) => {
        if (err) {
            console.error(err);
            res.statusCode(500);
            return;
        }
        res.status(200).send("Usuario eliminado");
    })
});

app.get("/watchlist", (req, res) => {
    res.status(200).render("watchlist");
});

app.get("/api/watchlist/:id", (req, res) => {
    const { id } = req.params;
    if (id == undefined) {
        res.sendStatus(400);
        return;
    }
    users.all("SELECT movie_id FROM watchlist WHERE user_id = ?", [id], (err, rows) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        const movieIds = rows.map(movie => movie.movie_id);
        db.all(`SELECT * FROM movie WHERE movie_id IN (${movieIds.join(", ")})`, (err2, rows2) => {
            if (err) {
                console.error(err2);
                res.sendStatus(500);
                return;
            }
            res.status(200).send(rows2);
        });
    });
});

app.post("/api/watchlist", (req, res) => {
    const { userId, movieId } = req.body;
    if (userId == undefined || movieId == undefined) {
        res.sendStatus(400);
        return;
    }
    users.all("INSERT INTO watchlist VALUES (?, ?)", [userId, movieId], (err, rows) => {
        if (err && err.message == "SQLITE_CONSTRAINT: UNIQUE constraint failed: watchlist.user_id, watchlist.movie_id") {
            res.status(200).send("La película ya se encuentra en la lista");
            return;
        }
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        res.status(200).send("Película agregada a la lista");
    });
});

app.delete("/api/watchlist", (req, res) => {
    const { userId, movieId } = req.body;
    if (userId == undefined || movieId == undefined) {
        res.sendStatus(400);
        return;
    }
    users.all("DELETE FROM watchlist WHERE user_id = ? AND movie_id = ?", [userId, movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        res.status(200).send("Película eliminada de la lista");
    });
});

app.get("/api/isinwatchlist", (req, res) => {
    const { userId, movieId } = req.query;
    if (userId == undefined && movieId == undefined) {
        res.sendStatus(400);
        return;
    }
    users.all("SELECT movie_id FROM watchlist WHERE movie_id = ? AND user_id = ?", [movieId, userId], (err, rows) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        if (rows.length == 0) res.status(200).send(false);
        else res.status(200).send(true);
    });
});

app.get("/cinema", (req, res) => {
    res.sendFile(__dirname + "/cinema.jpg");
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
