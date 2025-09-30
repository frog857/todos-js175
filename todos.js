const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const TodoList = require("./lib/todolist")
const { sortTodoLists, sortTodos } = require("./lib/sort");
const store = require("connect-loki");


const app = express();
const host = "localhost";
const port = 3000;

const LokiStore = store(session);

const Todo = require("./lib/todo.js");

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000,
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
}));

app.use(flash());

app.use((req, res, next) => {
  let todoLists = [];
  if ("todoLists" in req.session) {
    req.session.todoLists.forEach(todoList => {
      todoLists.push(TodoList.makeTodoList(todoList));
    })
  }

  req.session.todoLists = todoLists;
  next();
})

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
})

const loadTodoList = (todoListId, todoLists) => {
  return todoLists.find(list => list.id === todoListId);
}

const deleteTodoList = (todoList, todoLists) => {
  let todoIdx = todoLists.indexOf(todoList)
  todoLists.splice(todoIdx, 1);
}


const loadTodo = (todoListId, todoId, todoLists) => {
  let todoList = loadTodoList(todoListId, todoLists);
  
  if (!todoList) return undefined;
  return todoList.todos.find(todo => todo.id === todoId);
}



app.get("/", (req, res) => {
  res.redirect("/lists");
})

app.get("/lists", (req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(req.session.todoLists),
  });
});

app.get("/lists/new", (req, res) => {
  res.render("new-list");
});

app.post("/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({min: 1})
      .withMessage("Title is Required")
      .bail()
      .isLength({max: 100})
      .withMessage("Title cannot exceed 100 characters")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("That todo already exists")
  ], 
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(err => req.flash("error", err.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      req.session.todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash("flash success", "New Todo Created!")
      res.redirect("/lists")
    }
  }
)

app.get("/lists/:todoListId", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let selectedTodoList = loadTodoList(+todoListId, req.session.todoLists);

  if (selectedTodoList === undefined) {
    next(new Error("Not found."));
  } else {
    res.render("list", {
      todoList: selectedTodoList,
      todos: sortTodos(selectedTodoList),
    })
  }
});

//PP1
app.post("/lists/:todoListId/todos/:todoId/toggle", (req, res, next) => {
  let { todoId, todoListId } = { ...req.params };
  let selectedTodo = loadTodo(+todoListId, +todoId, req.session.todoLists);

  if (!selectedTodo) {
    next(new Error("Not Found."));
  } else {    
    selectedTodo.isDone() ? selectedTodo.markUndone() : selectedTodo.markDone();
    req.flash("flash success", `"${selectedTodo.title}" marked ${selectedTodo.isDone() ? "done" : "undone"}.`)
  }
  res.redirect(`/lists/${todoListId}`);
});

//PP2
app.post("/lists/:todoListId/todos/:todoId/destroy", (req, res, next) => {
  let { todoId, todoListId } = { ...req.params };
  let selectedTodo = loadTodo(+todoListId, +todoId, req.session.todoLists);
  let selectedTodoList = loadTodoList(+todoListId, req.session.todoLists);

  if (!selectedTodoList || !selectedTodo) {
    next(new Error("Not Found"));
  } else {
    let todoIdx = selectedTodoList.findIndexOf(selectedTodo);
    selectedTodoList.removeAt(todoIdx);
    req.flash("flash success", `${selectedTodo.title} was deleted successfully`);
  }
  res.redirect(`/lists/${todoListId}`);
});

//PP3
app.post("/lists/:todoListId/complete_all", (req, res, next) => {
  let { todoListId } = { ...req.params };
  let todoList = loadTodoList(+todoListId, req.session.todoLists);

  if (!todoList) {
    next(new Error("Not Found."));
  } else {
    todoList.markAllDone();
    req.flash("success", "All todos have been marked as done.");
    res.redirect(`/lists/${todoListId}`);
  }
})

//PP4
app.post("/lists/:todoListId/todos", 
  [
    body("todoTitle")
      .trim()
      .isLength({min: 1})
      .withMessage("Title is Required")
      .bail()
      .isLength({max: 100})
      .withMessage("Title cannot exceed 100 characters")
  ], 
  (req, res, next) => {
    let todoListId = req.params.todoListId;
    let selectedTodoList = loadTodoList(+todoListId, req.session.todoLists);
    if (!selectedTodoList) {
      next(new Error("Not found"));
    } else {
      let errors = validationResult(req);
      let todoTitle = req.body.todoTitle;
      if (!errors.isEmpty()) {
        errors.array().forEach(err => req.flash("flash error", err.msg));
        res.render("list", {
          flash: req.flash(),
          todoList: selectedTodoList,
          todos: sortTodos(selectedTodoList),
          todoTitle: todoTitle,
        })
      } else {
        selectedTodoList.add(new Todo(todoTitle));
        req.flash("flash success", `${todoTitle} successful added.`);
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
)

//PP6
app.get("/lists/:todoListId/edit", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = loadTodoList(+todoListId, req.session.todoLists);

  if (!todoList) {
    next(new Error("Not Found"));
  } else {
    res.render("edit-list", {todoList})
  }
})

//PP7
app.post("/lists/:todoListId/destroy", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = loadTodoList(+todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error("Not found"));
  } else {
    deleteTodoList(todoList, req.session.todoLists);
    req.flash("flash success", `${todoList.title} was deleted.`);
    res.redirect("/lists");
  }
})

//PP8
app.post("/lists/:todoListId/edit", 
  [
    body("todoListTitle")
      .trim()
      .isLength({min: 1})
      .withMessage("Title is Required")
      .bail()
      .isLength({max: 100})
      .withMessage("Title cannot exceed 100 characters")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("Title must be unique")
  ], 
  (req, res, next) => {
    let errors = validationResult(req);
    let todoListId = req.params.todoListId;
    let todoList = loadTodoList(+todoListId, req.session.todoLists);

    if (!errors.isEmpty()) {
      errors.array().forEach(err => req.flash("flash error", err.msg));
      res.render("edit-list", {
        todoList: todoList,
        todoListTitle: req.body.todoListTitle,
        flash: req.flash(),
      });
    } else {
      if (!todoList) {
        next(new Error("Not Found"));
      } else {
        let todoListTitle = req.body.todoListTitle;
        todoList.setTitle(todoListTitle);
        req.flash("flash success", `Todo List updated.`);
        res.redirect(`/lists/${todoListId}`);
      }
    }
})

app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

app.listen(port, host, () => {
  console.log("listening on port " + port + " of " + host + "...");
});


